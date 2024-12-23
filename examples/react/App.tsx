import React, { createRef, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, useGLTF, useAnimations, useFBX, useHelper } from '@react-three/drei';
import { AnimationClip, Group, Mesh, Object3DEventMap, SkeletonHelper } from 'three';
import { Perf } from 'r3f-perf';
import { useReactStats } from '../examplesUtils/ReactStats';
import { GLTFLoader, SkeletonUtils } from 'three/examples/jsm/Addons.js';
import { BoneInfluencePrunerPlugin } from 'three-skeleton-optimizer';
import { suspend } from 'suspend-react'
import { threshold } from 'three/webgpu';

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
      if (file.name.endsWith('.vrm')) {
        setIsVRM(true);
      } else {
        setIsVRM(false);
      }
      if(
        file.name.toLowerCase().endsWith('.gltf') || 
        file.name.toLowerCase().endsWith('.glb') || 
        file.name.toLowerCase().endsWith('.vrm')
      ){
        const url = URL.createObjectURL(file);
        onDrop(url);
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
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p>Drag and drop your skinned mesh to test the BoneInfluencePrunerPlugin</p>
      <button
        onClick={() => {
          onDrop('/three-skeleton-optimizer/models/demoSkinnedMeshReadyPlayerMe.glb')
        }}
      >Test with a ready player me avatar instead</button>
    </div>
  );
};

function Model({ url, withPlugin = false }) {
  console.log('withPlugin', withPlugin);
  const urlToLoad = useMemo(()=>withPlugin ? url.replace('.glb','-alt-path.glb') : url, [withPlugin, url]);
  console.log('urlToLoad', urlToLoad);

  const {scene, animations} = suspend(async ()=>{
    const loader = new GLTFLoader()
    if(withPlugin){
      loader.register((parser) => new BoneInfluencePrunerPlugin(parser, {
          bonesToRemove: [
              'LeftLeg', 
              'RightLeg', 
              // {name:'LeftFoot',threshold:0.2},
              // {name:'RightFoot',threshold:0.2},
              // {name:'LeftToeBase',threshold:0.2}, 
              // {name:'RightToeBase',threshold:0.2},
              // {name:'LeftToe_End',threshold:0.2},
              // {name:'RightToe_End',threshold:0.2}
          ],
          defaultInfluenceThreshold: 0.3,
          removeBones: true
      }));
    }
    const gltf = await loader.loadAsync(urlToLoad);
    return gltf;
  }, [urlToLoad, withPlugin])

  const ref = useRef<Group<Object3DEventMap>>(scene)
  const { animations: animationsBackup } = useFBX("/three-skeleton-optimizer/animations/HipHopDancing.fbx");
  
  const { actions } = useAnimations(animations, ref)
  const { actions: actionsBackup } = useAnimations(animationsBackup, ref)

  useEffect(() => {
    // play the first animation from the keys
    const firstClip = animations[0] as AnimationClip
    if(firstClip && actions[firstClip.name]){
      actions[firstClip.name]?.play()
    }else if(actionsBackup['mixamo.com']){
      actionsBackup['mixamo.com']?.play()
    }
  }, [actions])

  // add skeleton helper
  useHelper(ref, SkeletonHelper)

  return (
    <group >
      <primitive ref={ref} object={scene}></primitive>
    </group>
  )
}

function Scene({ownOrbitCtrlRef, otherOrbitCtrlRef}) {

  useReactStats();

  return (
    <>
      {/* Environment setup */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Grid infiniteGrid />
      <OrbitControls ref={ownOrbitCtrlRef} makeDefault onChange={(e)=>{
        if(otherOrbitCtrlRef.current){
          otherOrbitCtrlRef.current.object.position.copy(ownOrbitCtrlRef.current.object.position);
          otherOrbitCtrlRef.current.object.rotation.copy(ownOrbitCtrlRef.current.object.rotation);
          otherOrbitCtrlRef.current.object.matrix.copy(ownOrbitCtrlRef.current.object.matrix);
          otherOrbitCtrlRef.current.object.matrixWorld.copy(ownOrbitCtrlRef.current.object.matrixWorld);
          otherOrbitCtrlRef.current.target.copy(ownOrbitCtrlRef.current.target);
        }
      }} onEnd={()=>{
        if(otherOrbitCtrlRef.current){
          otherOrbitCtrlRef.current.update();
        }
      }} />

    </>
  );
}

export function App(): React.ReactElement {
  const [modelUrl, setModelUrl] = useState(null);
  const [isVRM, setIsVRM] = useState(null);
  const orbitControlsInstancesRefs = useMemo(()=>({
    _1: createRef(),
    _2: createRef(),
  }), []);
  console.log(modelUrl);
  console.log
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* <div className="controls">
        <h2>React Three Fiber Example</h2>
        <button>Optimize Skeleton</button>
        <a href="../" className="back-link">← Back to examples</a>
      </div> */}
      
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%' }}>
        <Canvas
          style={{ flex: 1 }}
          camera={{ position: [5, 5, 5], fov: 50 }}
          shadows
        >
          <Suspense fallback={null}>
            { modelUrl ? <Model url={modelUrl} /> : null }
          </Suspense >
          <Scene ownOrbitCtrlRef={orbitControlsInstancesRefs._1} otherOrbitCtrlRef={orbitControlsInstancesRefs._2} />
        </Canvas>
        <Canvas
          style={{ flex: 1 }}
          camera={{ position: [5, 5, 5], fov: 50 }}
          shadows
        >
          <Suspense fallback={null}>
            { modelUrl ? <Model url={modelUrl} withPlugin={true} /> : null }
          </Suspense >
          <Scene ownOrbitCtrlRef={orbitControlsInstancesRefs._2} otherOrbitCtrlRef={orbitControlsInstancesRefs._1} />
        </Canvas>
      </div>
      {!modelUrl ? <DropZone onDrop={setModelUrl} setIsVRM={setIsVRM} /> : null}
      
    </div>
  );
}