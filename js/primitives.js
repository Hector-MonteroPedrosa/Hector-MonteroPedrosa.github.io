import * as THREE from 'three';

export function createPrimitive(type) {
    let geometry;
    
    switch (type) {
        case 'cube':
            geometry = new THREE.BoxGeometry(1, 1, 1);
            break;
        case 'sphere':
            geometry = new THREE.SphereGeometry(0.75, 16, 16);
            break;
        case 'cylinder':
            geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
            break;
        default:
            geometry = new THREE.BoxGeometry(1, 1, 1);
    }

    const material = new THREE.MeshStandardMaterial({ 
        color: 0x909090, 
        roughness: 0.5,
        metalness: 0.1 
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${type.charAt(0).toUpperCase() + type.slice(1)}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Guardamos la configuración original para que los modificadores puedan recalcular la malla
    mesh.userData = {
        type: type,
        modifiers: []
    };

    return mesh;
}