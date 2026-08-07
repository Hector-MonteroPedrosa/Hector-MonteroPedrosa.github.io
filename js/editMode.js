import * as THREE from 'three';

export class EditModeManager {
    constructor(sceneManager) {
        this.sm = sceneManager;
        this.active = false;
        this.mode = 'VERTEX'; // 'VERTEX' | 'EDGE' | 'FACE'
        this.targetMesh = null;
        
        this.dummyTarget = new THREE.Object3D();
        this.sm.scene.add(this.dummyTarget);

        // Selección activa de vértices
        this.selectedVertexIndices = [];
        this.selectedEdgeIndex = null;
        this.selectedFaceIndex = null;

        this.lastGizmoPos = new THREE.Vector3();

        // Helpers de visualización
        this.unselectedPoints = null;
        this.selectedPoints = null;
        this.edgesLineSegments = null;
        this.selectedEdgeLine = null;
        this.faceOverlayMesh = null;

        // Textura circular
        this.circleTexture = this.createCircleTexture();

        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Points.threshold = 0.2;
        this.raycaster.params.Line.threshold = 0.15;
        this.mouse = new THREE.Vector2();

        this.isDraggingGizmo = false;

        // Topología
        this.topology = {
            uniqueVertices: [],
            edges: [],
            faces: []
        };

        this.initDOM();
        this.initEvents();
    }

    createCircleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    initDOM() {
        this.modeSelect = document.getElementById('mode-select');
        this.submodeContainer = document.getElementById('edit-select-modes');
        this.btnVertex = document.getElementById('btn-mode-vertex');
        this.btnEdge = document.getElementById('btn-mode-edge');
        this.btnFace = document.getElementById('btn-mode-face');

        if (this.modeSelect) {
            this.modeSelect.addEventListener('change', (e) => {
                this.setEditModeActive(e.target.value === 'EDIT');
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Tab' || e.key === 'Tab') {
                e.preventDefault();
                const newState = !this.active;
                if (this.modeSelect) this.modeSelect.value = newState ? 'EDIT' : 'OBJECT';
                this.setEditModeActive(newState);
            }

            if (this.active) {
                if (e.key === '1') this.setSubMode('VERTEX');
                if (e.key === '2') this.setSubMode('EDGE');
                if (e.key === '3') this.setSubMode('FACE');
            }
        });

        if (this.btnVertex) this.btnVertex.onclick = () => this.setSubMode('VERTEX');
        if (this.btnEdge) this.btnEdge.onclick = () => this.setSubMode('EDGE');
        if (this.btnFace) this.btnFace.onclick = () => this.setSubMode('FACE');
    }

    initEvents() {
        const dom = this.sm.renderer.domElement;

        dom.addEventListener('pointerdown', (e) => {
            if (!this.active || e.button !== 0 || this.isDraggingGizmo) return;

            const rect = dom.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            if (this.mode === 'VERTEX') this.raycastVertices(e.shiftKey);
            else if (this.mode === 'EDGE') this.raycastEdges(e.shiftKey);
            else if (this.mode === 'FACE') this.raycastFaces(e.shiftKey);
        });

        this.sm.transformControls.addEventListener('dragging-changed', (e) => {
            if (this.sm.controls) {
                this.sm.controls.enabled = !e.value;
            }
            if (!this.active) return;
            this.isDraggingGizmo = e.value;
            
            if (e.value) {
                this.lastGizmoPos.copy(this.dummyTarget.position);
            } else {
                // Al terminar de arrastrar, recalculamos topología y reconstruimos helpers
                this.buildTopology();
                this.createOverlayHelpers();
            }
        });

        this.sm.transformControls.addEventListener('change', () => {
            if (!this.active || !this.isDraggingGizmo || this.selectedVertexIndices.length === 0) return;

            const currentPos = this.dummyTarget.position;
            const worldDelta = new THREE.Vector3().subVectors(currentPos, this.lastGizmoPos);
            this.lastGizmoPos.copy(currentPos);

            if (worldDelta.lengthSq() === 0) return;

            const invMatrix = new THREE.Matrix4().copy(this.targetMesh.matrixWorld).invert();
            const localDelta = worldDelta.clone().applyMatrix4(invMatrix).sub(
                new THREE.Vector3(0, 0, 0).applyMatrix4(invMatrix)
            );

            const posAttr = this.targetMesh.geometry.attributes.position;

            // Mover los vértices reales de la malla
            this.selectedVertexIndices.forEach(idx => {
                posAttr.setXYZ(
                    idx,
                    posAttr.getX(idx) + localDelta.x,
                    posAttr.getY(idx) + localDelta.y,
                    posAttr.getZ(idx) + localDelta.z
                );
            });

            posAttr.needsUpdate = true;
            this.targetMesh.geometry.computeVertexNormals();
            this.targetMesh.geometry.computeBoundingBox();
            this.targetMesh.geometry.computeBoundingSphere();

            // Actualizar solo las posiciones de los helpers visuales en tiempo real sin destruir la topología
            this.updateHelpersPositions();
        });
    }

    setEditModeActive(active) {
        if (active) {
            this.targetMesh = this.sm.selectedObject || this.sm.objects[0];

            if (!this.targetMesh || !this.targetMesh.isMesh) {
                this.active = false;
                if (this.modeSelect) this.modeSelect.value = 'OBJECT';
                return;
            }

            if (this.sm.selectedObject !== this.targetMesh) {
                this.sm.select(this.targetMesh);
            }

            this.active = true;

            if (this.targetMesh.geometry && this.targetMesh.geometry.index !== null) {
                if (typeof this.targetMesh.geometry.toNonIndexed === 'function') {
                    this.targetMesh.geometry = this.targetMesh.geometry.toNonIndexed();
                }
            }

            if (this.submodeContainer) this.submodeContainer.classList.remove('hidden');
            if (this.sm.selectionBox) this.sm.scene.remove(this.sm.selectionBox);

            this.buildTopology();
            this.clearSelection();
            this.createOverlayHelpers();
        } else {
            this.active = false;
            if (this.submodeContainer) this.submodeContainer.classList.add('hidden');
            this.removeOverlayHelpers();
            if (this.targetMesh) {
                this.sm.select(this.targetMesh);
            }
        }
    }

    setSubMode(submode) {
        this.mode = submode;
        [this.btnVertex, this.btnEdge, this.btnFace].forEach(btn => btn?.classList.remove('active'));
        if (submode === 'VERTEX' && this.btnVertex) this.btnVertex.classList.add('active');
        if (submode === 'EDGE' && this.btnEdge) this.btnEdge.classList.add('active');
        if (submode === 'FACE' && this.btnFace) this.btnFace.classList.add('active');

        this.clearSelection();
        this.createOverlayHelpers();
    }

    clearSelection() {
        this.selectedVertexIndices = [];
        this.selectedEdgeIndex = null;
        this.selectedFaceIndex = null;
        this.updateGizmoAndSelection();
    }

    buildTopology() {
        if (!this.targetMesh) return;
        const posAttr = this.targetMesh.geometry.attributes.position;
        const eps = 0.0001;

        // 1. Unificar vértices por posición
        const unique = [];
        for (let i = 0; i < posAttr.count; i++) {
            const p = new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            let found = unique.find(u => u.pos.distanceTo(p) < eps);
            if (found) {
                found.indices.push(i);
            } else {
                unique.push({ id: unique.length, pos: p, indices: [i] });
            }
        }

        const attrToUniqueId = new Array(posAttr.count);
        unique.forEach(u => u.indices.forEach(idx => attrToUniqueId[idx] = u.id));

        // 2. Triángulos
        const triCount = posAttr.count / 3;
        const triangles = [];
        for (let i = 0; i < triCount; i++) {
            const u0 = attrToUniqueId[i * 3];
            const u1 = attrToUniqueId[i * 3 + 1];
            const u2 = attrToUniqueId[i * 3 + 2];
            triangles.push({
                id: i,
                v: [u0, u1, u2],
                rawIndices: [i * 3, i * 3 + 1, i * 3 + 2],
                usedInQuad: false
            });
        }

        // 3. Fusionar triángulos en Quads
        const faces = [];
        for (let i = 0; i < triangles.length; i++) {
            const t1 = triangles[i];
            if (t1.usedInQuad) continue;

            let paired = false;
            for (let j = i + 1; j < triangles.length; j++) {
                const t2 = triangles[j];
                if (t2.usedInQuad) continue;

                const shared = t1.v.filter(v => t2.v.includes(v));
                if (shared.length === 2) {
                    t1.usedInQuad = true;
                    t2.usedInQuad = true;
                    paired = true;

                    const un1 = t1.v.find(v => !shared.includes(v));
                    const un2 = t2.v.find(v => !shared.includes(v));
                    
                    const quadVertices = [shared[0], un1, shared[1], un2];
                    const allRawIndices = [...t1.rawIndices, ...t2.rawIndices];

                    faces.push({
                        uniqueVIndices: quadVertices,
                        allRawIndices: allRawIndices
                    });
                    break;
                }
            }

            if (!paired) {
                faces.push({
                    uniqueVIndices: t1.v,
                    allRawIndices: t1.rawIndices
                });
            }
        }

        // 4. Edges únicos
        const edgesMap = new Map();
        faces.forEach(face => {
            const vList = face.uniqueVIndices;
            for (let k = 0; k < vList.length; k++) {
                const a = vList[k];
                const b = vList[(k + 1) % vList.length];
                const key = a < b ? `${a}_${b}` : `${b}_${a}`;

                if (!edgesMap.has(key)) {
                    edgesMap.set(key, { v1: a, v2: b, key });
                }
            }
        });

        this.topology = {
            uniqueVertices: unique,
            edges: Array.from(edgesMap.values()),
            faces: faces
        };
    }

    raycastVertices(isShift) {
        if (!this.unselectedPoints) return;

        this.raycaster.setFromCamera(this.mouse, this.sm.camera);
        const intersects = this.raycaster.intersectObject(this.unselectedPoints);

        if (intersects.length > 0) {
            const hitIndex = intersects[0].index;
            const uniqueId = this.topology.uniqueVertices.findIndex(u => u.indices.includes(hitIndex));
            
            if (uniqueId !== -1) {
                const connectedIndices = this.topology.uniqueVertices[uniqueId].indices;

                if (isShift) {
                    const exists = connectedIndices.some(idx => this.selectedVertexIndices.includes(idx));
                    if (exists) {
                        this.selectedVertexIndices = this.selectedVertexIndices.filter(idx => !connectedIndices.includes(idx));
                    } else {
                        this.selectedVertexIndices.push(...connectedIndices);
                    }
                } else {
                    this.selectedVertexIndices = [...connectedIndices];
                }
            }
        } else if (!isShift) {
            this.selectedVertexIndices = [];
        }

        this.updateGizmoAndSelection();
    }

    raycastEdges(isShift) {
        if (!this.edgesLineSegments) return;

        this.raycaster.setFromCamera(this.mouse, this.sm.camera);
        const intersects = this.raycaster.intersectObject(this.edgesLineSegments);

        if (intersects.length > 0) {
            const hitSegmentIndex = Math.floor(intersects[0].index / 2);
            if (hitSegmentIndex < this.topology.edges.length) {
                const edge = this.topology.edges[hitSegmentIndex];
                
                const u1 = this.topology.uniqueVertices[edge.v1];
                const u2 = this.topology.uniqueVertices[edge.v2];
                const edgeIndices = [...u1.indices, ...u2.indices];

                this.selectedEdgeIndex = hitSegmentIndex;
                this.selectedVertexIndices = edgeIndices;
            }
        } else if (!isShift) {
            this.selectedEdgeIndex = null;
            this.selectedVertexIndices = [];
        }

        this.updateGizmoAndSelection();
    }

    raycastFaces(isShift) {
        if (!this.targetMesh) return;

        this.raycaster.setFromCamera(this.mouse, this.sm.camera);
        const intersects = this.raycaster.intersectObject(this.targetMesh);

        if (intersects.length > 0) {
            const triangleIndex = intersects[0].faceIndex;
            const rawIndex = triangleIndex * 3;

            const faceIdx = this.topology.faces.findIndex(f => f.allRawIndices.includes(rawIndex));

            if (faceIdx !== -1) {
                const face = this.topology.faces[faceIdx];
                const faceIndices = [];

                face.uniqueVIndices.forEach(uId => {
                    faceIndices.push(...this.topology.uniqueVertices[uId].indices);
                });

                this.selectedFaceIndex = faceIdx;
                this.selectedVertexIndices = faceIndices;
            }
        } else if (!isShift) {
            this.selectedFaceIndex = null;
            this.selectedVertexIndices = [];
        }

        this.updateGizmoAndSelection();
    }

    createOverlayHelpers() {
        this.removeOverlayHelpers();
        if (!this.targetMesh) return;

        const posAttr = this.targetMesh.geometry.attributes.position;

        if (this.mode === 'VERTEX') {
            const unselectedGeo = new THREE.BufferGeometry().setAttribute('position', posAttr);
            const unselectedMat = new THREE.PointsMaterial({
                color: 0x00d2ff, size: 10, sizeAttenuation: false,
                map: this.circleTexture, transparent: true, depthTest: true, depthWrite: false
            });
            this.unselectedPoints = new THREE.Points(unselectedGeo, unselectedMat);
            this.unselectedPoints.renderOrder = 998;
            this.targetMesh.add(this.unselectedPoints);

            const selectedGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
            const selectedMat = new THREE.PointsMaterial({
                color: 0xff9900, size: 14, sizeAttenuation: false,
                map: this.circleTexture, transparent: true, depthTest: true, depthWrite: false
            });
            this.selectedPoints = new THREE.Points(selectedGeo, selectedMat);
            this.selectedPoints.renderOrder = 999;
            this.targetMesh.add(this.selectedPoints);
        }

        if (this.mode === 'EDGE') {
            const edgeGeo = new THREE.BufferGeometry();
            const edgeMat = new THREE.LineBasicMaterial({ color: 0x00d2ff, linewidth: 2, depthTest: true });
            this.edgesLineSegments = new THREE.LineSegments(edgeGeo, edgeMat);
            this.edgesLineSegments.renderOrder = 998;
            this.targetMesh.add(this.edgesLineSegments);

            const selEdgeGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([], 3));
            const selEdgeMat = new THREE.LineBasicMaterial({ color: 0xff9900, linewidth: 4, depthTest: true });
            this.selectedEdgeLine = new THREE.LineSegments(selEdgeGeo, selEdgeMat);
            this.selectedEdgeLine.renderOrder = 999;
            this.targetMesh.add(this.selectedEdgeLine);
        }

        if (this.mode === 'FACE') {
            const overlayGeo = new THREE.BufferGeometry();
            const overlayMat = new THREE.MeshBasicMaterial({
                color: 0xff9900, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthTest: true
            });
            this.faceOverlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
            this.faceOverlayMesh.renderOrder = 999;
            this.targetMesh.add(this.faceOverlayMesh);
        }

        this.updateHelpersPositions();
        this.updateGizmoAndSelection();
    }

    updateHelpersPositions() {
        if (!this.targetMesh) return;
        const posAttr = this.targetMesh.geometry.attributes.position;

        // Actualizar Puntos Vértices
        if (this.selectedPoints && this.mode === 'VERTEX') {
            const selPositions = [];
            this.selectedVertexIndices.forEach(idx => {
                selPositions.push(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
            });
            this.selectedPoints.geometry.setAttribute('position', new THREE.Float32BufferAttribute(selPositions, 3));
            this.selectedPoints.geometry.attributes.position.needsUpdate = true;
        }

        // Actualizar estructura completa de líneas de Edges a partir del atributo de posición dinámico
        if (this.edgesLineSegments && this.mode === 'EDGE') {
            const edgePositions = [];
            this.topology.edges.forEach(e => {
                const idx1 = this.topology.uniqueVertices[e.v1].indices[0];
                const idx2 = this.topology.uniqueVertices[e.v2].indices[0];
                edgePositions.push(
                    posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1),
                    posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2)
                );
            });
            this.edgesLineSegments.geometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
            this.edgesLineSegments.geometry.attributes.position.needsUpdate = true;
        }

        // Actualizar Edge Seleccionado
        if (this.selectedEdgeLine && this.mode === 'EDGE') {
            const selPositions = [];
            if (this.selectedEdgeIndex !== null && this.topology.edges[this.selectedEdgeIndex]) {
                const e = this.topology.edges[this.selectedEdgeIndex];
                const idx1 = this.topology.uniqueVertices[e.v1].indices[0];
                const idx2 = this.topology.uniqueVertices[e.v2].indices[0];
                selPositions.push(
                    posAttr.getX(idx1), posAttr.getY(idx1), posAttr.getZ(idx1),
                    posAttr.getX(idx2), posAttr.getY(idx2), posAttr.getZ(idx2)
                );
            }
            this.selectedEdgeLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(selPositions, 3));
            this.selectedEdgeLine.geometry.attributes.position.needsUpdate = true;
        }

        // Actualizar Cara Seleccionada
        if (this.faceOverlayMesh && this.mode === 'FACE') {
            if (this.selectedFaceIndex !== null && this.topology.faces[this.selectedFaceIndex]) {
                const face = this.topology.faces[this.selectedFaceIndex];
                const facePositions = [];

                face.allRawIndices.forEach(idx => {
                    facePositions.push(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx));
                });

                this.faceOverlayMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
                this.faceOverlayMesh.geometry.attributes.position.needsUpdate = true;
                this.faceOverlayMesh.visible = true;
            } else {
                this.faceOverlayMesh.visible = false;
            }
        }
    }

    updateGizmoAndSelection() {
        this.updateHelpersPositions();

        if (this.selectedVertexIndices.length > 0) {
            const posAttr = this.targetMesh.geometry.attributes.position;
            const center = new THREE.Vector3();

            this.selectedVertexIndices.forEach(idx => {
                center.add(new THREE.Vector3(posAttr.getX(idx), posAttr.getY(idx), posAttr.getZ(idx)));
            });

            center.divideScalar(this.selectedVertexIndices.length);
            center.applyMatrix4(this.targetMesh.matrixWorld);

            this.dummyTarget.position.copy(center);
            this.dummyTarget.rotation.set(0, 0, 0);
            this.dummyTarget.scale.set(1, 1, 1);

            this.lastGizmoPos.copy(center);
            this.sm.transformControls.attach(this.dummyTarget);
        } else {
            this.sm.transformControls.detach();
        }
    }

    removeOverlayHelpers() {
        if (this.targetMesh) {
            if (this.unselectedPoints) this.targetMesh.remove(this.unselectedPoints);
            if (this.selectedPoints) this.targetMesh.remove(this.selectedPoints);
            if (this.edgesLineSegments) this.targetMesh.remove(this.edgesLineSegments);
            if (this.selectedEdgeLine) this.targetMesh.remove(this.selectedEdgeLine);
            if (this.faceOverlayMesh) this.targetMesh.remove(this.faceOverlayMesh);
        }

        [this.unselectedPoints, this.selectedPoints, this.edgesLineSegments, this.selectedEdgeLine, this.faceOverlayMesh].forEach(obj => {
            if (obj) {
                obj.geometry?.dispose();
                obj.material?.dispose();
            }
        });

        this.unselectedPoints = null;
        this.selectedPoints = null;
        this.edgesLineSegments = null;
        this.selectedEdgeLine = null;
        this.faceOverlayMesh = null;
        this.sm.transformControls.detach();
    }

    update() {}
}