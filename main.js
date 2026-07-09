import * as THREE from 'three';

// --- Sub-systems & Viewport Initialization ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12); // Deep space hue

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 12);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Enable shadows for greater depth perception

const existingCanvas = document.querySelector('canvas');
if (existingCanvas) existingCanvas.remove();
document.body.appendChild(renderer.domElement);

// --- High-Fidelity Lighting Layout ---
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

const ambientLight = new THREE.AmbientLight(0x22223b, 0.8);
scene.add(ambientLight);

// Add a subtle grid floor helper to visually ground our spatial coordinates
const gridHelper = new THREE.GridHelper(20, 20, 0x44445c, 0x222233);
gridHelper.position.y = -0.5;
scene.add(gridHelper);

// --- Core Repositories & Databases ---
const entities = new Map();
const activeIdsInCurrentFrame = new Set();

// --- Primitive Geometry Factory Map ---
const geometryFactory = {
    box: () => new THREE.BoxGeometry(1, 1, 1),
    sphere: () => new THREE.SphereGeometry(0.6, 32, 32),
    cylinder: () => new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32),
    torus: () => new THREE.TorusGeometry(0.5, 0.15, 16, 100)
};

// --- Behavioral Registry Executables ---
// Tracks procedural transformations applied over time based on spec configurations
const behaviors = {
    spin: (mesh, data, time) => {
        const speed = data.behaviorSpeed || 1.0;
        mesh.rotation.y += 0.01 * speed;
    },
    bounce: (mesh, data, time) => {
        const speed = data.behaviorSpeed || 2.0;
        const amplitude = data.behaviorAmplitude || 1.0;
        const base = data.position.y;
        mesh.position.y = base + Math.abs(Math.sin(time * speed)) * amplitude;
        mesh.rotation.y += 0.005;
    },
    orbit: (mesh, data, time) => {
        const speed = data.behaviorSpeed || 1.0;
        const radius = data.behaviorRadius || 3.0;
        const centerX = data.position.x;
        const centerZ = data.position.z;
        mesh.position.x = centerX + Math.cos(time * speed) * radius;
        mesh.position.z = centerZ + Math.sin(time * speed) * radius;
        mesh.rotation.x += 0.01;
    }
};

/**
 * Parses structural row elements and binds material, shape, and behavior tracks.
 */
function interpretEntityLine(line) {
    if (!line.trim()) return;

    try {
        const data = JSON.parse(line);
        if (data.type !== 'entity') return;

        activeIdsInCurrentFrame.add(data.id);

        let mesh;

        if (entities.has(data.id)) {
            // TARGETED UPDATES: Mutate parameters if geometry matches
            mesh = entities.get(data.id);
            
            // If the mesh type changed, rebuild it; otherwise preserve reference
            if (mesh.userData.shapeType !== data.mesh) {
                scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                mesh = createNewMesh(data);
                entities.set(data.id, mesh);
            } else {
                mesh.position.set(data.position.x, data.position.y, data.position.z);
                mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);
                mesh.material.color.setHex(parseInt(data.color));
            }
        } else {
            // INITIAL BINDING: Generate clean asset instances
            mesh = createNewMesh(data);
            entities.set(data.id, mesh);
        }

        // Cache full raw parameters on userData block for runtime behavior lookup
        mesh.userData.spec = data;

    } catch (e) {
        console.error("[Interpreter Engine Failure]:", e, line);
    }
}

function createNewMesh(data) {
    const buildGeo = geometryFactory[data.mesh] || geometryFactory.box;
    const geometry = buildGeo();
    
    const material = new THREE.MeshStandardMaterial({
        color: parseInt(data.color),
        roughness: 0.2,
        metalness: 0.2,
        wireframe: data.wireframe || false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(data.position.x, data.position.y, data.position.z);
    mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    mesh.userData.shapeType = data.mesh;
    scene.add(mesh);
    return mesh;
}

// --- Dynamic Stream Pipeline Connection ---
function connectToEcosystemPipeline() {
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onmessage = (event) => {
        activeIdsInCurrentFrame.clear();
        const lines = event.data.split('\n');
        
        for (const line of lines) {
            interpretEntityLine(line);
        }

        // Garbage Collector Pass
        entities.forEach((mesh, id) => {
            if (!activeIdsInCurrentFrame.has(id)) {
                scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                entities.delete(id);
            }
        });
    };

    ws.onclose = () => setTimeout(connectToEcosystemPipeline, 2000);
}

// --- Window Layout Adapters ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- System Engine Render Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const elapsedTime = clock.getElapsedTime();

    // Evaluate active structural behavior components line-by-line
    entities.forEach((mesh) => {
        const spec = mesh.userData.spec;
        if (spec && spec.behavior && behaviors[spec.behavior]) {
            behaviors[spec.behavior](mesh, spec, elapsedTime);
        }
    });

    renderer.render(scene, camera);
}

connectToEcosystemPipeline();
animate();