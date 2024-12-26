import { findBones } from '../boneUtilities/findBones';
import { removeGeometryForBone } from '../boneUtilities/removeGeometryForBone';
import { removeBoneFromSkeleton } from '../boneUtilities/removeBoneFromSkeleton';
import { SkinnedMesh } from 'three';
import { GLTF, GLTFLoaderPlugin, GLTFParser } from 'three/examples/jsm/Addons.js';
import { BoneInfluencePrunerPluginOptions } from '../types';

export class BoneInfluencePrunerPlugin implements GLTFLoaderPlugin {
	public readonly parser: GLTFParser;
	public readonly bonesToRemove: (string | { name: string, threshold: number })[];
	public readonly defaultInfluenceThreshold: number;
	public readonly removeBones: boolean;

	get name() {

		return 'BoneInfluencePrunerPlugin';

	}

	constructor(parser: GLTFParser, options: BoneInfluencePrunerPluginOptions) {

		this.parser = parser;
		this.bonesToRemove = options.bonesToRemove || [];
		this.defaultInfluenceThreshold = options.defaultInfluenceThreshold || 0.3;
		this.removeBones = options.removeBones || false;

	}

	async afterRoot(gltf: GLTF): Promise<void> {

		const skinnedMeshes: SkinnedMesh[] = [];
		gltf.scene.traverse(child => {

			if (child instanceof SkinnedMesh) {

				skinnedMeshes.push(child);

			}

		});

		for (const skinnedMesh of skinnedMeshes) {

			const skeleton = skinnedMesh.skeleton;

			const bones = await findBones(gltf, this.bonesToRemove.map(bone => typeof bone === 'string' ? bone : bone.name));
			// console.log('found bones', bones)
			Object.entries(bones).forEach(([name, node], index) => {

				if (node) {

					// @ts-ignore - \_(ツ)_/¯
					const threshold = typeof this.bonesToRemove[index] === 'string' ? this.defaultInfluenceThreshold : this.bonesToRemove[index].threshold;
					const boneIndex = skeleton.bones.findIndex(bone => bone === node);
					// console.log('name', name, threshold, boneIndex, skeleton.bones[boneIndex])
					const newGeometry = removeGeometryForBone(skinnedMesh, boneIndex, threshold ?? this.defaultInfluenceThreshold);
					skinnedMesh.geometry.dispose();
					skinnedMesh.geometry = newGeometry;

				} else {

					console.log(`Could not find VRM bone: ${name}`);

				}

			});

			if (this.removeBones) {

				Object.entries(bones).forEach(([_name, node]) => {
					if (node) {

						const boneIndex = skeleton.bones.findIndex(bone => bone === node);

						removeBoneFromSkeleton(skinnedMesh, boneIndex)

					}
				});

			}

		}

	}

}