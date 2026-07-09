import * as THREE from 'three';

// --- Sub-systems & Scene Architecture Initialization ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 10);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Guard against duplicating the canvas element during Vite hot-reloads
const existingCanvas = document.querySelector('canvas');
if (existingCanvas) {
    existingCanvas.remove();
}
document.body.appendChild(renderer.domElement);

// Generic Environment Lighting
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0x333333);
scene.add(ambientLight);

// --- Live Entity Database Registry ---
const entities = new Map();
const activeIdsInCurrentFrame = new Set();

/**
 * Parses and maps a single line from the structural text data stream into Three.js instances.
 */
function interpretEntityLine(line) {
    if (!line.trim()) return;

    try {
        const data = JSON.parse(line);
        if (data.type !== 'entity') return;

        // Register that this asset is actively present in the specification stream
        activeIdsInCurrentFrame.add(data.id);

        // Targeted Mutation: If the entity exists, mutate properties instead of destroying the mesh
        if (entities.has(data.id)) {
            const mesh = entities.get(data.id);
            mesh.position.set(data.position.x, data.position.y, data.position.z);
            mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);
            mesh.material.color.setHex(parseInt(data.color));
            return;
        }

        // Factory Instantiation: Build the structural geometry from the spec rules
        let geometry;
        if (data.mesh === 'box') {
            geometry = new THREE.BoxGeometry(1, 1, 1); // Normalized unit dimensions
        } else {
            geometry = new THREE.BoxGeometry(1, 1, 1); 
        }

        const material = new THREE.MeshStandardMaterial({ 
            color: parseInt(data.color),
            roughness: 0.3,
            metalness: 0.1
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        mesh.scale.set(data.scale.x, data.scale.y, data.scale.z);

        // Store reference in memory registry and commit to the active scene
        entities.set(data.id, mesh);
        scene.add(mesh);

    } catch (e) {
        console.error("[Interpreter] Error parsing structural stream line:", e, "Line context:", line);
    }
}

// --- Dynamic Stream Pipeline Connection ---
function connectToEcosystemPipeline() {
    console.log('[Pipeline] Establishing connection to Python server at ws://localhost:8000/ws...');
    const ws = new WebSocket('ws://localhost:8000/ws');

    ws.onopen = () => {
        console.log('%c[Pipeline] Connected successfully! Data-streaming loop active.', 'color: #00ff00; font-weight: bold;');
    };

    ws.onmessage = (event) => {
        console.log("[Pipeline] Live specification delta packet intercepted.");
        
        // Clear the layout tracking array for the current update pass
        activeIdsInCurrentFrame.clear();
        
        // Dissect raw stream segments line-by-line
        const lines = event.data.split('\n');
        for (const line of lines) {
            interpretEntityLine(line);
        }

        // Garbage Collector Frame: Purge objects dropped entirely from the specification file
        entities.forEach((mesh, id) => {
            if (!activeIdsInCurrentFrame.has(id)) {
                console.log(`[Pipeline] Entity '${id}' absent from spec. Deallocating memory...`);
                scene.remove(mesh);
                mesh.geometry.dispose();
                mesh.material.dispose();
                entities.delete(id);
            }
        });
    };

    ws.onclose = (event) => {
        console.warn(`[Pipeline] Connection severed (Code: ${event.code}). Retrying lifecycle bind in 2 seconds...`);
        setTimeout(connectToEcosystemPipeline, 2000);
    };

    ws.onerror = (err) => {
        console.error('[Pipeline] Operational connection error:', err);
        ws.close();
    };
}

// --- Window Layout Adapters ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Main Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    // Low-overhead baseline procedural rotation to visually prove the animation loop is running
    entities.forEach((mesh) => {
        mesh.rotation.y += 0.005;
    });

    renderer.render(scene, camera);
}

// Execute systems
connectToEcosystemPipeline();
animate();