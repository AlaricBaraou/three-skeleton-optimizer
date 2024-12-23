import { GLTF } from "three/examples/jsm/Addons.js";
import { Bone, Object3D, SkinnedMesh } from "three";
import { getVRMBoneMappings } from "./getVRMBoneMappings.js";

export async function findBones(gltf: GLTF, targetBones: string[]) {

	const isVRM = gltf.parser.json.extensionsUsed?.includes('VRMC_vrm') || gltf.parser.json.extensions?.VRM !== undefined;
	const result: { [key: string]: Object3D | null } = {};

	if (isVRM) {
		const boneMapping = getVRMBoneMappings(gltf);

		await Promise.all(
			targetBones.map(async (boneName) => {

				const nodeIndex = boneMapping[boneName];
				if (nodeIndex !== undefined) {

					try {

						const node = await gltf.parser.getDependency('node', nodeIndex);
						result[boneName] = node;

					} catch (error) {

						console.warn(`Failed to get node for bone ${boneName}`, error);
						result[boneName] = null;

					}

				} else {

					result[boneName] = null;

				}

			})
		);
	} else {
		// Find the first SkinnedMesh in the scene
		let skinnedMesh: SkinnedMesh | undefined;
		gltf.scene.traverse((object) => {
			if (object instanceof SkinnedMesh && !skinnedMesh) {
				skinnedMesh = object;
			}
		});

		if (!skinnedMesh || !skinnedMesh.skeleton) {
			console.warn('No SkinnedMesh found in the GLTF scene');
			return result;
		}

		console.log('skinnedMesh.skeleton.bones', skinnedMesh.skeleton.bones)
		// Map each bone name to its index in the skeleton
		// skinnedMesh.skeleton.bones.forEach((bone: Bone) => {
		// 	result[bone.name] = bone;
		// });
		for (const boneName of targetBones) {
			const bone = skinnedMesh.skeleton.bones.find((bone) => bone.name === boneName);
			result[boneName] = bone || null;
		}
	}

	return result;

}

