import { GLTF } from "three/examples/jsm/Addons.js";
import { HumanoidHumanBones } from '@pixiv/types-vrmc-vrm-animation-1.0';
import { VRM as V0VRM, HumanoidBone as VRM0HumanoidBone } from '@pixiv/types-vrm-0.0';

interface BoneMapping {
	[boneName: string]: number;
}

export function getVRMBoneMappings(gltf: GLTF) {

	const json = gltf.parser.json;
	const boneMapping: BoneMapping = {};

	// Try VRM 1.0 format first
	const vrmExtension = json.extensionsUsed !== undefined ? json.extensionsUsed.includes('VRMC_vrm') : false;
	if (vrmExtension) {

		const extension = json.extensions['VRMC_vrm'] || {};
		const humanoid = extension.humanoid || {};
		if (humanoid.humanBones) {

			for (const [boneName, humanBone] of Object.entries(extension.humanoid.humanBones as HumanoidHumanBones)) {
				const node = humanBone?.node;
				if (node != null) {
					boneMapping[boneName] = node;
				}

			};
			return boneMapping;

		}

	}

	// Fallback to VRM 0.0 format
	if (json.extensions) {

		const vrmExt = json.extensions.VRM || {} as V0VRM | undefined;
		const humanoid = vrmExt.humanoid || {};
		if (humanoid.humanBones) {


			vrmExt.humanoid.humanBones.forEach((bone: VRM0HumanoidBone) => {

				if (bone.bone && bone.node !== undefined) {

					boneMapping[bone.bone] = bone.node;

				}

			});

		}
	}

	return boneMapping;

}