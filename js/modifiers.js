import * as THREE from 'three';

export function applyModifiers(mesh) {
    if (!mesh.userData || !mesh.userData.modifiers) return;

    // Por ahora reevaluamos modificadores simples sobre la geometría
    mesh.userData.modifiers.forEach(mod => {
        if (mod.type === 'array') {
            // Lógica preliminar para modificador Array (ejemplo funcional básico)
            // Se puede extender usando InstancedMesh o Merge Geometries
        }
        if (mod.type === 'subsurf') {
            // Lógica de subdivisión de superficie
        }
    });

    mesh.geometry.computeVertexNormals();
}

export function addModifierToMesh(mesh, modifierType) {
    const modifierData = {
        id: THREE.MathUtils.generateUUID(),
        type: modifierType,
        count: 2,
        offset: [2, 0, 0]
    };

    mesh.userData.modifiers.push(modifierData);
    applyModifiers(mesh);
    return modifierData;
}