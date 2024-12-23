import React, { useState } from 'react';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export const DebugSkinnedMeshGenerator = () => {
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(2);
  const [segments, setSegments] = useState(10);

  class TestModelGenerator {

    public scene: THREE.Scene;

    constructor() {
      this.scene = new THREE.Scene();
    }

    createGradientInfluenceModel(width = 10, height = 2, segments = 10) {
      // Clear previous scene
      while(this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }

      const armature = new THREE.Object3D();

      const geometry = new THREE.PlaneGeometry(width, height, segments, 1);
      const material = new THREE.MeshBasicMaterial({ 
        side: THREE.DoubleSide 
      });
      const skinnedMesh = new THREE.SkinnedMesh(geometry, material);

      const bones:THREE.Bone[] = [];
      const startBone = new THREE.Bone();
      startBone.name = 'startBone';
      startBone.position.set(-width/2, 0, 0);
      bones.push(startBone);

      const endBone = new THREE.Bone();
      endBone.name = 'endBone';
      endBone.position.set(width/2, 0, 0);
      bones.push(endBone);
      startBone.add(endBone);

      const skeleton = new THREE.Skeleton(bones);
      skinnedMesh.bind(skeleton);

      armature.add(skinnedMesh);
      armature.add(bones[0]);

      const position = geometry.attributes.position;
      const skinIndices = new THREE.Float32BufferAttribute(position.count * 4, 4);
      const skinWeights = new THREE.Float32BufferAttribute(position.count * 4, 4);

      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const t = (x + width/2) / width;
        const startInfluence = 1 - t;
        const endInfluence = t;

        skinIndices.setXYZW(i, 0, 1, 0, 0);
        skinWeights.setXYZW(i, startInfluence, endInfluence, 0, 0);
      }

      geometry.setAttribute('skinIndex', skinIndices);
      geometry.setAttribute('skinWeight', skinWeights);

      console.log('armature', armature);

      this.scene.add(armature);
      return this;
    }

    async exportToGLTF() {
      return new Promise((resolve, reject) => {
        const exporter = new GLTFExporter();
        const options = {
          binary: false,
          animations: [],
          onlyVisible: true
        };

        exporter.parse(
          this.scene,
          function (result) {
            resolve(result);
          },
          function (error) {
            reject(error);
          },
          options
        );
      });
    }
  }

  const downloadGLTF = async (modelType) => {
    const generator = new TestModelGenerator();
    
    if (modelType === 'gradient') {
      generator.createGradientInfluenceModel(width, height, segments);
    }

    try {
      const gltfData = await generator.exportToGLTF();
      
      // Convert GLTF data to string
      const gltfString = JSON.stringify(gltfData, null, 2);
      
      // Create blob and download
      const blob = new Blob([gltfString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_model_${modelType}.gltf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating GLTF:', error);
    }
  };

  return (
    <div >
      <h1 >Test Model Generator</h1>
      
      <div >
        <div>
          <label>Width</label>
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
        </div>
        
        <div>
          <label>Height</label>
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
          />
        </div>
        
        <div>
          <label>Segments/Sections</label>
          <input
            type="number"
            value={segments}
            onChange={(e) => setSegments(Number(e.target.value))}
          />
        </div>
      </div>
      
      <div >
        <button
          onClick={() => downloadGLTF('gradient')}
        >
          Download Gradient Model
        </button>
        
      </div>
    </div>
  );
};
