import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.objects = [];
        this.selectedObject = null;
        this.selectionBox = null;

        this.initScene();
        this.initCamera();
        this.initRenderer();
        this.initLights();
        this.initControls();
        this.initGrid();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e1e1e);
    }

    initCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(5, 5, 5);
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(10, 20, 15);
        dirLight.castShadow = true;
        this.scene.add(dirLight);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Mapeo idéntico a Blender:
        // Clic Central (MMB) = Rotar
        // Shift + Clic Central (MMB) = Panear
        // Rueda de Scroll = Zoom
        this.controls.mouseButtons = {
            LEFT: null, // Clic izquierdo para selección/Gizmo
            MIDDLE: THREE.MOUSE.ROTATE, // Clic central de la rueda para rotar
            RIGHT: null // Desactivado para no chocar con la rueda
        };

        this.controls.enableZoom = true;
        this.controls.zoomSpeed = 1.2;
        this.controls.enablePan = true;
        this.controls.screenSpacePanning = true;

        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.scene.add(this.transformControls);

        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });
    }

    initGrid() {
        const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
        gridHelper.position.y = -0.01;
        this.scene.add(gridHelper);
    }

    add(object) {
        this.scene.add(object);
        if (object.isMesh) {
            this.objects.push(object);
            if (!this.selectedObject) {
                this.select(object);
            }
        }
    }

    select(object) {
        if (this.selectedObject === object) return;

        this.selectedObject = object;

        if (this.selectionBox) {
            this.scene.remove(this.selectionBox);
            this.selectionBox = null;
        }

        if (object && object.isMesh) {
            this.selectionBox = new THREE.BoxHelper(object, 0xffa500);
            this.scene.add(this.selectionBox);
        } else {
            this.transformControls.detach();
        }
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
    }

    render() {
        this.controls.update();

        if (this.selectionBox) {
            this.selectionBox.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}