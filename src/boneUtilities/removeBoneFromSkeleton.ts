import { BufferGeometry, Skeleton, SkinnedMesh } from "three";

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