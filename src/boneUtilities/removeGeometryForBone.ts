import { BufferAttribute, BufferGeometry, SkinnedMesh } from "three";

export function removeGeometryForBone(skinnedMesh: SkinnedMesh, boneIndex: number, influenceThreshold = 0.3) {

	const geometry = skinnedMesh.geometry;
	const weights = geometry.attributes.skinWeight;
	const joints = geometry.attributes.skinIndex;
	const positions = geometry.attributes.position;
	const indices = geometry.index;

	// Track which vertices should be kept
	const keepVertex = new Array(positions.count).fill(true);
	let removedCount = 0;

	// Check each vertex
	for (let i = 0; i < positions.count; i++) {

		// Check all 4 possible bone influences for this vertex
		for (let j = 0; j < 4; j++) {

			const jointIndex = joints.getComponent(i, j);
			const weight = weights.getComponent(i, j);

			// If this vertex is influenced by our target bone beyond the threshold
			if (jointIndex === boneIndex && weight > influenceThreshold) {

				keepVertex[i] = false;
				removedCount++;
				break;

			}

		}

	}

	// Create new arrays with only the vertices we're keeping
	const newPositions = new Float32Array((positions.count - removedCount) * 3);
	const newWeights = new Float32Array((positions.count - removedCount) * 4);
	const newJoints = new Float32Array((positions.count - removedCount) * 4);

	// Create a map of old vertex indices to new ones
	const oldToNewIndex = new Map();
	let newIndex = 0;

	for (let i = 0; i < positions.count; i++) {

		if (keepVertex[i]) {

			// Copy position
			newPositions[newIndex * 3] = positions.getX(i);
			newPositions[newIndex * 3 + 1] = positions.getY(i);
			newPositions[newIndex * 3 + 2] = positions.getZ(i);

			// Copy weights and joints
			for (let j = 0; j < 4; j++) {

				newWeights[newIndex * 4 + j] = weights.getComponent(i, j);
				newJoints[newIndex * 4 + j] = joints.getComponent(i, j);

			}

			oldToNewIndex.set(i, newIndex);
			newIndex++;

		}

	}

	// Update indices if they exist
	let newIndices;
	if (indices) {

		const newIndicesArray = [];
		for (let i = 0; i < indices.count; i += 3) {

			const a = indices.getX(i);
			const b = indices.getX(i + 1);
			const c = indices.getX(i + 2);

			// Only keep triangles where all vertices are kept
			if (keepVertex[a] && keepVertex[b] && keepVertex[c]) {

				newIndicesArray.push(
					oldToNewIndex.get(a),
					oldToNewIndex.get(b),
					oldToNewIndex.get(c)
				);

			}

		}

		newIndices = new Uint16Array(newIndicesArray);

	}

	// Create new geometry with updated attributes
	const newGeometry = new BufferGeometry();
	newGeometry.setAttribute('position', new BufferAttribute(newPositions, 3));
	newGeometry.setAttribute('skinWeight', new BufferAttribute(newWeights, 4));
	newGeometry.setAttribute('skinIndex', new BufferAttribute(newJoints, 4));

	if (newIndices) {

		newGeometry.setIndex(new BufferAttribute(newIndices, 1));

	}

	// Copy other attributes (UVs, normals, etc.)
	for (const key in geometry.attributes) {

		if (!['position', 'skinWeight', 'skinIndex'].includes(key)) {

			const attribute = geometry.attributes[key];
			const itemSize = attribute.itemSize;
			const newArray = new Float32Array((positions.count - removedCount) * itemSize);
			let newIdx = 0;

			for (let i = 0; i < positions.count; i++) {

				if (keepVertex[i]) {

					for (let j = 0; j < itemSize; j++) {

						newArray[newIdx * itemSize + j] = attribute.getComponent(i, j);

					}

					newIdx++;

				}

			}

			newGeometry.setAttribute(key, new BufferAttribute(newArray, itemSize));

		}

	}

	return newGeometry;

}