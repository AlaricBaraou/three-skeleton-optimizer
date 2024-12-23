import React, { Children, createRef, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, useGLTF, useAnimations, useFBX, useHelper, GizmoHelper, GizmoViewport, AccumulativeShadows, RandomizedLight, Billboard, Text } from '@react-three/drei';
import { AnimationClip, Bone, Box3, Color, Group, Mesh, Object3DEventMap, ShaderMaterial, SkeletonHelper, SkinnedMesh, TextureLoader, UniformsUtils, Vector3 } from 'three';
import { useReactStats } from '../examplesUtils/ReactStats';
import { GLTF, GLTFLoader } from 'three/examples/jsm/Addons.js';
import { VRMLoaderPlugin } from '@pixiv/three-vrm';

import * as THREE from 'three';
import { CustomSkeletonHelper } from '../examplesUtils/CustomSkeletonHelper';
import { DebugSkinnedMeshGenerator } from './DebugSkinnedMeshGenerator';

class MeshSkeletonHelper extends THREE.Object3D {
    constructor(skinnedMesh) {
        super();

        this.skinnedMesh = skinnedMesh;
        this.skeleton = skinnedMesh.skeleton;
        this.boneMeshes = [];
        
        // Create a material for the bone meshes
        this.boneMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            depthTest: false,
            depthWrite: false
        });
        this.worldScale = new THREE.Vector3();

        this.init();
        this.update();
    }

    init() {
        // Clear existing bone meshes
        this.boneMeshes.forEach(mesh => this.remove(mesh));
        this.boneMeshes = [];

        console.log('this.skinnedMesh.scale', this.skinnedMesh.scale)

        this.skinnedMesh.getWorldScale(this.worldScale)

        // Create a mesh for each bone
        this.skeleton.bones.forEach((bone, index) => {
            // Create a cylinder geometry for the bone
            const {
                length: boneLength,
                orientation: boneOrientation
            } = this.getBoneLengthAndOrientation(bone);
            const geometry = new THREE.CylinderGeometry(
                0.01 * (1/this.worldScale.y), // radiusTop
                0.01 * (1/this.worldScale.y), // radiusBottom
                boneLength,        // height
                8                  // radialSegments
            );
            
            // Rotate and translate the geometry to align with bone direction
            geometry.translate(0, boneLength / 2, 0);
       
            //get the default bone matrix from the skeleton?
            // make sure not affected by the current pose / animation
      

            const boneMesh = new THREE.Mesh(geometry, this.boneMaterial);
            boneMesh.name = `bone-${index}`;
            boneMesh.renderOrder = Infinity
            this.boneMeshes.push(boneMesh);
            this.add(boneMesh);

        });
    }

    getBoneLengthAndOrientation(bone) {
      // Get the bone's end position by looking at its children
      if (bone.children.length > 0) {
          // Use the position of the first child bone
          const childPosition = new THREE.Vector3();
          bone.children[0].getWorldPosition(childPosition);
          this.skinnedMesh.worldToLocal(childPosition);
          
          const bonePosition = new THREE.Vector3();
          bone.getWorldPosition(bonePosition);
          this.skinnedMesh.worldToLocal(bonePosition);
        
          // Calculate orientation as normalized direction vector from bone to child
          const orientation = new THREE.Vector3()
              .subVectors(childPosition, bonePosition)
              .normalize();
          
          return {
              length: childPosition.distanceTo(bonePosition),
              orientation: orientation
          };
      }
      
      // For end bones (no children), use parent's orientation if available
      if (bone.parent && bone.parent.isBone) {
          const parentLength = this.getBoneLength(bone.parent);
          const parentOrientation = new THREE.Vector3();
          bone.parent.getWorldDirection(parentOrientation);
          
          return {
              length: parentLength * 0.5,
              orientation: parentOrientation
          };
      }
  
      // Default length and orientation (pointing up) for bones without children or parent
      return {
          length: 0.1,
          orientation: new THREE.Vector3(0, 1, 0)
      };
  }


    getBoneLength(bone) {
        // Get the bone's end position by looking at its children
        if (bone.children.length > 0) {
            // Use the position of the first child bone
            const childPosition = new THREE.Vector3();
            bone.children[0].getWorldPosition(childPosition);
            this.skinnedMesh.worldToLocal(childPosition);
            
            const bonePosition = new THREE.Vector3();
            bone.getWorldPosition(bonePosition);
            this.skinnedMesh.worldToLocal(bonePosition);
            
            return childPosition.distanceTo(bonePosition);
        }
        
        // For end bones (no children), use a default length or calculate based on parent
        if (bone.parent && bone.parent.isBone) {
            const parentLength = this.getBoneLength(bone.parent);
            return parentLength * 0.5;
        }

        // Default length for bones without children or parent
        return 0.1;
    }

    update() {
        const bones = this.skeleton.bones;
        
        bones.forEach((bone, index) => {
            const boneMesh = this.boneMeshes[index];
            if (!boneMesh) return;

            // Update bone mesh position and rotation
            boneMesh.matrix.copy(bone.matrixWorld)
            boneMesh.matrix.decompose(boneMesh.position, boneMesh.quaternion, boneMesh.scale);
            boneMesh.matrixWorld.copy(bone.matrixWorld)
            
            
        });
    }

    dispose() {
        this.boneMeshes.forEach(mesh => {
            mesh.geometry.dispose();
        });
        this.boneMaterial.dispose();
    }
}

export { MeshSkeletonHelper };

class BoneInfluenceMaterialV2 extends THREE.MeshStandardMaterial {
  constructor(options = {}) {

      options.transparent = true

      super(options);

      this.userData.uniforms = {
        targetBoneIndex: { value: this.targetBoneIndex },
        influenceThreshold: { value: this.influenceThreshold },
        discardTriangle: { value: this.discardTriangle },
      };

      // Store uniforms that we'll need to inject
      this.targetBoneIndex = options.targetBoneIndex ?? 0;
      this.influenceThreshold = options.influenceThreshold ?? 1;
      this.discardTriangle = options.discardTriangle ?? 1;
      this.colorramp = new THREE.TextureLoader().load('/three-skeleton-optimizer/examplesUtils/colorramp.jpg');

      this.onBeforeCompile = (shader) => {
          // Add our custom uniforms
          shader.uniforms.targetBoneIndex = { value: this.targetBoneIndex };
          shader.uniforms.influenceThreshold = { value: this.influenceThreshold };
          shader.uniforms.discardTriangle = { value: this.discardTriangle };
          shader.uniforms.colorramp = { value: this.colorramp };
          this.userData.uniforms = shader.uniforms

          // Add varying in both vertex and fragment
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            uniform float targetBoneIndex;
            varying float vInfluence;
            flat out float triangleInfluence;`
        );

        // Add the influence calculation in vertex shader
        shader.vertexShader = shader.vertexShader.replace(
            '#include <skinning_vertex>',
            `#include <skinning_vertex>
            
            // Calculate total influence from target bone
            float vertexInfluence = 0.0;
            #ifdef USE_SKINNING
                for(int i = 0; i < 4; i++) {
                    if(skinIndex[i] == targetBoneIndex) {
                        vertexInfluence += skinWeight[i];
                    }
                }
            #endif
            
            vInfluence = vertexInfluence;
            
            triangleInfluence = vertexInfluence;`
        );

          // Add varying and uniforms to fragment shader
          shader.fragmentShader = shader.fragmentShader.replace(
              '#include <common>',
              `#include <common>
              uniform float targetBoneIndex;
              uniform float influenceThreshold;
              uniform int discardTriangle;
              uniform sampler2D colorramp;
              varying float vInfluence;
              flat in float triangleInfluence;`
          );

          // Replace the fragment shader's color assignment
          shader.fragmentShader = shader.fragmentShader.replace(
              'vec4 diffuseColor = vec4( diffuse, opacity );',
              `// Discard fragment if influence is above threshold
              if(discardTriangle == 1 && triangleInfluence > influenceThreshold) {
                  discard;
              }
              float newOpacity = opacity;
              if(vInfluence > influenceThreshold) {
                  newOpacity = discardTriangle == 1 ? opacity * 0.5 : opacity;
              }

              // Get color from the ramp texture based on influence
              vec4 weightColor = texture2D(colorramp, vec2(vInfluence, 0.5));
              
              // Apply the weight color
              vec3 finalColor = weightColor.rgb;

              if (vInfluence > 0.01) {  // Don't show lines for zero weights
                  float steps = 10.0;  // Number of contour lines
                  float rel_value = vInfluence * steps;
                  float grid = abs(fract(rel_value + 0.5) - 0.5);
              }
              
              vec4 diffuseColor = vec4(finalColor, newOpacity);`
          );
      };
  }

  // Add setters for updating the values
  set targetBoneIndex(value) {
      this._targetBoneIndex = value;
      this.userData.uniforms.targetBoneIndex.value = value;
      this.needsUpdate = true;
  }

  get targetBoneIndex() {
      return this._targetBoneIndex;
  }

  set influenceThreshold(value) {
      this._influenceThreshold = value;
      this.userData.uniforms.influenceThreshold.value = value;
      this.needsUpdate = true;
  }

  get influenceThreshold() {
      return this._influenceThreshold;
  }

  set discardTriangle(value) {
      this._discardTriangle = value;
      this.userData.uniforms.discardTriangle.value = value;
      this.needsUpdate = true;
  }

  get discardTriangle() {
      return this._discardTriangle;
  }
}

const boneInfluenceMaterial = new BoneInfluenceMaterialV2({
  targetBoneIndex: 0,
  influenceThreshold: 1,
})

const DropZone = ({ onDrop, setIsVRM }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    console.log(file);
    if (file) {
      let isVRM = false;
      if (file.name.endsWith('.vrm')) {
        isVRM = true;
      } else {
        isVRM = false;
      }
      setIsVRM(isVRM);
      if(
        file.name.toLowerCase().endsWith('.gltf') || 
        file.name.toLowerCase().endsWith('.glb') || 
        file.name.toLowerCase().endsWith('.vrm')
      ){
        const url = URL.createObjectURL(file);

        const loader = new GLTFLoader();
        if(isVRM){
          loader.register((parser) => new VRMLoaderPlugin(parser));
        }
        loader.load(url, (gltf)=>{
          onDrop(gltf);
        });
      }
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1,
        height: "100vh",
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        background: "rgba(0, 0, 0, 0.3)",
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p>Drag and drop your skinned mesh to test the BoneInfluencePrunerPlugin</p>
      <button
        onClick={() => {
          const loader = new GLTFLoader();
          loader.load('/three-skeleton-optimizer/models/demoSkinnedMeshReadyPlayerMe.glb', (gltf)=>{
            onDrop(gltf);
          });
        }}
      >Test with a ready player me avatar instead</button>
      <button
        onClick={() => {
          const loader = new GLTFLoader();
          loader.load('/three-skeleton-optimizer/models/king_k_rool.glb', (gltf)=>{
            onDrop(gltf);
          });
        }}
      >Test with a skinned mesh avatar instead</button>
      <button
        onClick={() => {
          const loader = new GLTFLoader();
          loader.register((parser) => new VRMLoaderPlugin(parser));
          loader.load('/three-skeleton-optimizer/models/tokito.vrm', (gltf)=>{
            onDrop(gltf);
          });
        }}>
          Test with a VRM avatar
        </button>
      <DebugSkinnedMeshGenerator />
    </div>
  );
};

function BonesName({bone,setBoneIndex}) {

  const pos = new Vector3();
  bone.getWorldPosition(pos)

  const fontProps = { font: '/three-skeleton-optimizer/fonts/Inter-Bold.woff', fontSize: 0.01, letterSpacing: -0.05, lineHeight: 1, 'material-toneMapped': false }

  const over = (e) => {

  }

  const out = (e) => {

  }

  const click = (e) => {
    setBoneIndex(bone.userData.boneIndex)
  }

  return <Billboard position={pos} key={bone.name}>
    <Text onPointerOver={over} onPointerOut={out} onClick={click} {...fontProps}>
      <meshBasicMaterial color="white" depthTest={false} depthWrite={false} />
      {bone.name}
    </Text>
  </Billboard>
}


function BonesNames({gltf, setBoneIndex}) {

  const { scene } = gltf;
  const skinnedMesh = scene.getObjectByProperty('type', 'SkinnedMesh') as SkinnedMesh;

  return skinnedMesh.skeleton.bones.map((bone) => {
   
    return <BonesName key={bone.name} setBoneIndex={setBoneIndex} bone={bone} />
  })
}

function Model({ gltf, setBoneIndex }) {
  const {scene, animations} = gltf

  console.log('scene', scene)

  const ref = useRef<Group<Object3DEventMap>>(scene)

  // add skeleton helper
  useHelper(ref, CustomSkeletonHelper)

  const skeletonHelper = useMemo(() => {
    const skinnedMesh = scene.getObjectByProperty('type', 'SkinnedMesh') as SkinnedMesh
    const skeletonHelper = new MeshSkeletonHelper(skinnedMesh);     
    return skeletonHelper
  }, [scene])

  useFrame(() => {
    skeletonHelper.update();
  })

  useMemo(() => {
    // add shadows to each mesh 
    scene.traverse((child) => {
      if(child instanceof Mesh || child instanceof SkinnedMesh){
        child.castShadow = true;
        child.receiveShadow = true;
      }
    })
  }, [scene])

  return (
    < >
      <primitive ref={ref} object={scene}></primitive>
      <primitive object={skeletonHelper}></primitive>
      <BonesNames setBoneIndex={setBoneIndex} gltf={gltf} />
    </>
  )
}

function Scene({gltf, isDarkMode}) {

  const ctrlRef = useRef(null);
  const refShadows = useRef(null);
  const [maxDistance, setMaxDistance] = useState(10);

  const targetCenter = useMemo(() => {
    const center = new Vector3();
    if(gltf){
      // compute bbox and get center
      const vector = new THREE.Vector3();
      const box = new THREE.Box3().makeEmpty();
    
      gltf.scene.traverse((child)=>{
        if(!(child instanceof SkinnedMesh)) return 
        const position = child.geometry.attributes.position;

        for ( let i = 0, il = position.count; i < il; i ++ ) {
  
          vector.fromBufferAttribute( position, i );
          child.applyBoneTransform( i, vector );
          child.localToWorld( vector );
          box.expandByPoint( vector );
  
        }
      })
      box.getCenter(center);
    }
    return center;
  }, [gltf]);

  useEffect(() => {
    if(ctrlRef.current && gltf){
      const bbox = new Box3().setFromObject(gltf.scene);
      //set max distance based on the bbox size
      const _temp = new Vector3();
      bbox.getSize(_temp)
      const maxDistance = _temp.length();
      ctrlRef.current.maxDistance = maxDistance * 1.5;
      ctrlRef.current.update()
      ctrlRef.current.maxDistance = maxDistance * 3;
      setMaxDistance(maxDistance * 3);
    }
  }, [gltf])

  useReactStats();

  useFrame(() => {
    refShadows.current.update()
  })

  return (
    <>
      {/* Environment setup */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <Grid position={[0, -0.01, 0]} infiniteGrid followCamera={false} fadeDistance={maxDistance * 2} fadeStrength={2} cellColor={'#00ffff'} sectionColor='#9d4b4b' cellSize={0.2} sectionSize={1} />
      <OrbitControls ref={ctrlRef} makeDefault target={targetCenter}  />
      <mesh>
        <sphereGeometry args={[1000]} />
        <meshBasicMaterial color={isDarkMode ? '#404040' : '#dddddd'} side={THREE.BackSide} />
      </mesh>
    
      <AccumulativeShadows ref={refShadows} frames={1} opacity={0.2} scale={maxDistance}>
        <directionalLight position={[10, 10, 5]} intensity={3} castShadow />
      </AccumulativeShadows>
      
    </>
  );
}

const BonesTree = ({bones, isDarkMode, setBoneIndex}) => {
  const [nameFilter,setNameFilter] = useState('')
  const [threshold, setThreshold] = useState(boneInfluenceMaterial.influenceThreshold);

  useEffect(() => {
    boneInfluenceMaterial.influenceThreshold = threshold
  },[threshold])

  const filteredBones = useMemo(() => {
    return bones.filter(bone => bone.name.toLowerCase().includes(nameFilter.toLowerCase()))
  }, [bones, nameFilter])

  return <div id='bones-tree'
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '300px',
      height: '100vh',
      overflowY: 'auto',
      zIndex: 1,
      padding: '20px',
      backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      color: isDarkMode ? 'white' : 'black',
    }}
  >
    <label className="block text-sm font-medium text-gray-700 mb-1">
        Threshold: {threshold.toFixed(2)}
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={threshold}
        onChange={(e) => setThreshold(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
    <input type="text" placeholder="Search for a bone"
      onChange={
        (e) => {
          setNameFilter(e.target.value)
        }
      }
    />
    {
      filteredBones.map((bone, index) => (
        (!filteredBones.includes(bone.parent)) ? (
          <TreeBone key={bone.name} bone={bone} level={0} setBoneIndex={setBoneIndex}/>
        ) : null
      ))
    }
  </div>
} 

const TreeBone = ({ bone, level = 0, setBoneIndex }) => {
  const [isExpanded, setIsExpanded] = useState(level <=4 ? true : false);
  const hasChildren = bone.children && bone.children.length > 0;

  return (
    <div >
      <div 
        
        style={{ paddingLeft: `${level * 20}px` }}
      >
        {hasChildren && (
          <span className="mr-1">
          </span>
        )}
        {!hasChildren && <span className="w-4 mr-1" />}
        <span>{bone.name}</span>
        <button onClick={()=>setBoneIndex(bone.userData.boneIndex)}>view</button>
        {!isExpanded && hasChildren && <button
          onClick={() => setIsExpanded(true)}
        >+{bone.userData.totalDescendant}</button>}
        {isExpanded && hasChildren && <button
          onClick={() => setIsExpanded(false)}
        >close</button>}
      </div>
      
      {isExpanded && hasChildren && (
        <div>
          {bone.children.map((child, index) => (
            <TreeBone 
              key={`${child.name}-${index}`}
              bone={child}
              level={level + 1}
              setBoneIndex={setBoneIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DarkModeSwitch = ({isDarkMode, setIsDarkMode}) => {


  return <div style={{
    position: 'fixed',
    right: 100,
    top: 0,
    zIndex: 2,
    padding: '20px',
  }}>
    <label >
      Dark Mode
    </label>
    <input
      type="checkbox"
      checked={isDarkMode}
      onChange={() => setIsDarkMode(!isDarkMode)}
    />
  </div>

}

export function App(): React.ReactElement {
  const [isVRM, setIsVRM] = useState(null);
  const [gltf, setGltf] = useState<GLTF>();
  const [isDarkMode, setIsDarkMode] = useState( window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [boneIndex,setBoneIndex] = useState(boneInfluenceMaterial.targetBoneIndex)

  useEffect(() => {
    boneInfluenceMaterial.targetBoneIndex = boneIndex
  },[boneIndex])

  const bones = useMemo(() => {
    const bones = []
    // recover the bones of the first skinned mesh found in the scene
    if(gltf){
      gltf.scene.traverse((child) => {
        if(child instanceof SkinnedMesh){
          child.material = boneInfluenceMaterial;
        }
      })
      const skinnedMesh = gltf.scene.getObjectByProperty('type', 'SkinnedMesh') as SkinnedMesh
      if(skinnedMesh){
        return skinnedMesh.skeleton.bones.map((bone,index) => {
          let countDescendant = 0
          bone.traverse((bone) => {
            countDescendant++
          })
          bone.userData.totalDescendant = countDescendant
          bone.userData.boneIndex = index
          return bone
        })
      }
      
    }
    return bones;
  }, [gltf]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <DarkModeSwitch isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}/>
      <BonesTree bones={bones} isDarkMode={isDarkMode} setBoneIndex={setBoneIndex}/>
        <Canvas
          style={{ flex: 1 }}
          camera={{ position: [5, 5, 5], fov: 50, far: 9999 }}
          shadows
        >
          {/* <color attach="background" args={[isDarkMode ? '#303035' : '#dddddd'  ]} /> */}
          { gltf ? <Model gltf={gltf} setBoneIndex={setBoneIndex} /> : null }
          <Scene gltf={gltf} isDarkMode={isDarkMode} />
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#9d4b4b', '#2f7f4f', '#3b5b9d']} labelColor="white" />
          </GizmoHelper>
        </Canvas>
      {!gltf ? <DropZone onDrop={setGltf} setIsVRM={setIsVRM} /> : null}
      
    </div>
  );
}