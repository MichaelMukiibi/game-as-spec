import * as THREE from 'three';

// --- Sub-systems Initialization [cite: 20] ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Generic lighting setup for a clearer 3D view
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// --- Engine Entity Registry Database  ---
const entities = new Map();

// --- Atomic Data Parser / Interpreter [cite: 18, 21] ---
function parseEntityLine(line) {
    if (!line.trim()) return;
    
    try {
        const data = JSON.parse(line);
        
        // Strict Type Check Guard [cite: 36]
        if (data.type !== 'entity') return;

        // Micro-targeted updates: If it already exists, update memory layout instantly [cite: 28, 44]
        if (entities.has(data.id)) {
            const mesh = entities.get(data.id);
            mesh.position.set(data.position.x, data.position.y, data.position.z);
            return;
        }

        // Generic Factory Execution Logic: Map raw data parameters to real engine instances [cite: 11, 24]
        let geometry;
        if (data.mesh === 'box') {
            geometry = new THREE.BoxGeometry(data.scale.x, data.scale.y, data.scale.z);
        }

        const material = new THREE.MeshStandardMaterial({ 
            color: parseInt(data.color), 
            roughness: 0.4 
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        
        // Store the reference for hot-reloading loops or state tracks [cite: 28, 37]
        entities.set(data.id, mesh);
        scene.add(mesh);

    } catch (e) {
        console.error("Loss of type safety or malformed string line encountered:", e); // [cite: 36]
    }
}

// --- Stream Ingestion Engine [cite: 27, 41] ---
async function loadWorldSpecification() {
    const response = await fetch('/world.jsonl');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let partialLine = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialLine + chunk).split('\n');
        partialLine = lines.pop(); // Hold onto incomplete trailing chunks

        for (const line of lines) {
            parseEntityLine(line);
        }
    }
    if (partialLine) parseEntityLine(partialLine);
}

// --- Dynamic Runtime Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Simple Animation/Render Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    // Slowly rotate whatever entities exist inside our data architecture
    entities.forEach((mesh) => {
        mesh.rotation.y += 0.005;
    });

    renderer.render(scene, camera);
}



// Boot up the declarative ecosystem 
loadWorldSpecification();
animate();