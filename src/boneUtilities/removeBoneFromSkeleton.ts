import { Bone, BufferGeometry, Skeleton, SkinnedMesh } from "three";

export function removeBoneFromSkeleton(skinnedMesh: SkinnedMesh, boneIndex: number) {
    // First remove the geometry influenced by the bone

    // Update the skin indices to account for the bone removal
    updateSkinIndices(skinnedMesh.geometry, boneIndex);

    // 2. Get the bone being removed
    const removedBone = skinnedMesh.skeleton.bones[boneIndex];

    // 4. Update the skeleton
    const newBones = skinnedMesh.skeleton.bones.filter((_, index) => index !== boneIndex);
    const newBoneInverses = skinnedMesh.skeleton.boneInverses.filter((_, index) => index !== boneIndex);

    // 5. Create a new skeleton with updated bones
    const newSkeleton = new Skeleton(newBones, newBoneInverses);

    // 6. Update bone hierarchy
    if (removedBone.parent) {
        for (const child of removedBone.children) {
            removedBone.parent.add(child);
        }
        removedBone.parent.remove(removedBone);
    }

    // 7. Create new skinned mesh
    skinnedMesh.skeleton = newSkeleton;

}

function updateSkinIndices(geometry: BufferGeometry, removedBoneIndex: number) {
    const skinIndices = geometry.attributes.skinIndex;
    const skinWeights = geometry.attributes.skinWeight;

    for (let i = 0; i < skinIndices.count; i++) {
        for (let j = 0; j < 4; j++) {
            const idx = skinIndices.getComponent(i, j);
            const weight = skinWeights.getComponent(i, j);

            if (idx > removedBoneIndex) {
                skinIndices.setComponent(i, j, idx - 1);
            } else if (idx === removedBoneIndex) {

                skinIndices.setComponent(i, j, 0);
                skinWeights.setComponent(i, j, 0);

            }
        }

        // Normalize weights after modification
        let totalWeight = 0;
        for (let j = 0; j < 4; j++) {
            totalWeight += skinWeights.getComponent(i, j);
        }
        if (totalWeight > 0) {
            for (let j = 0; j < 4; j++) {
                const weight = skinWeights.getComponent(i, j);
                skinWeights.setComponent(i, j, weight / totalWeight);
            }
        }
    }

    skinIndices.needsUpdate = true;
    skinWeights.needsUpdate = true;
}

function updateBoneHierarchy(bone: Bone, removedBone: Bone) {
    const children = [...bone.children];
    for (const child of children) {
        if (child === removedBone) {
            // Reparent this bone's children to its parent
            const parent = bone;
            for (const grandChild of child.children) {
                parent.add(grandChild);
            }
            child.parent.remove(child);
        } else {
            updateBoneHierarchy(child, removedBone);
        }
    }
}

function updateAnimationTracks(skinnedMesh, removedBoneIndex) {
    if (skinnedMesh.animations) {
        for (const animation of skinnedMesh.animations) {
            const tracks = animation.tracks.filter(track => {
                const boneIndex = parseInt(track.name.split('[')[1]);
                return boneIndex !== removedBoneIndex;
            });

            // Update track names for bones with higher indices
            tracks.forEach(track => {
                const matches = track.name.match(/\[(\d+)\]/);
                if (matches) {
                    const boneIndex = parseInt(matches[1]);
                    if (boneIndex > removedBoneIndex) {
                        track.name = track.name.replace(
                            `[${boneIndex}]`,
                            `[${boneIndex - 1}]`
                        );
                    }
                }
            });

            animation.tracks = tracks;
        }
    }
}