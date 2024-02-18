import * as THREE from 'three';
import * as dat from 'dat.gui';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';


// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// Camera setup
const camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 10);
camera.lookAt(new THREE.Vector3(0, 0, 0));

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
document.body.appendChild(renderer.domElement);

// Controls setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 15;
controls.update();

// HDR Environment setup
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
let envMapIntensity = 1; // Default intensity
new RGBELoader().setPath('assets/').load('environment.hdr', function (texture) {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmremGenerator.dispose();

    // Apply environment map intensity to all relevant materials in the scene
    scene.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
            obj.material.envMap = envMap;
            obj.material.envMapIntensity = envMapIntensity;
            obj.material.needsUpdate = true;
        }
    });
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Dropzone and file input setup
const dropzone = document.getElementById('dropzone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;

dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    event.stopPropagation();
}, false);

dropzone.addEventListener('drop', event => {
    event.preventDefault();
    event.stopPropagation();
    handleFile(event.dataTransfer!.files[0]);
}, false);

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files!.length > 0) {
        handleFile(fileInput.files![0]);
    }
});

function handleFile(file) {
    if (file.name.toLowerCase().endsWith('.glb')) {
        document.getElementById('loading-indicator').style.display = 'block'; // Show loading indicator
        loadGLBFile(file);
    } else {
        alert('Unsupported file format. Please select only GLB files.');
    }
}


function loadGLBFile(file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
        hideDropzone();
        const loader = new GLTFLoader();
        loader.load(
            URL.createObjectURL(file),
            (gltf) => {
                scene.add(gltf.scene);
                centerAndScaleModel(gltf.scene);
                addBoundingBox(gltf.scene);
                document.getElementById('loading-indicator').style.display = 'none';
            },
            (xhr) => {
                const percentComplete = (xhr.loaded / xhr.total) * 100;
                document.getElementById('loading-progress').style.width = percentComplete + '%';
            },
            (error) => {
                console.error('Error loading GLB file:', error);
                document.getElementById('loading-indicator').style.display = 'none';
            }
        );
    };
    reader.readAsArrayBuffer(file);
}

let boundingBoxHelper; // Reference to the bounding box helper
let boundingBoxDimensions; // Store dimensions here


function addBoundingBox(object) {
    const box = new THREE.Box3().setFromObject(object);
    if (boundingBoxHelper) scene.remove(boundingBoxHelper); // Remove previous helper if exists
    boundingBoxHelper = new THREE.BoxHelper(object, 0x8B0000); // Dark red color
    scene.add(boundingBoxHelper);

      // Display axes
    //  const axesHelper = new THREE.AxesHelper(5);
     // scene.add(axesHelper);

    // Calculate and store dimensions
    const size = box.getSize(new THREE.Vector3());
    boundingBoxDimensions = {
        x: (size.x * 100).toFixed(2),
        y: (size.y * 100).toFixed(2),
        z: (size.z * 100).toFixed(2)
    };

    // Adjust camera and controls to fit object
    fitCameraToObject(object);
}


function fitCameraToObject(object) {
    const boundingBox = new THREE.Box3().setFromObject(object);

    const size = boundingBox.getSize(new THREE.Vector3()); // Get bounding box size
    const center = boundingBox.getCenter(new THREE.Vector3()); // Get bounding box center

    const maxSize = Math.max(size.x, size.y, size.z);
    const fitHeightDistance = maxSize / (2 * Math.atan(Math.PI * camera.fov / 360));
    const fitWidthDistance = fitHeightDistance / camera.aspect;
    const distance = Math.max(fitHeightDistance, fitWidthDistance);

    const direction = new THREE.Vector3().subVectors(camera.position, center).normalize();

    // Move the camera to a position distance away from the center, maintaining its direction
    camera.position.copy(direction.multiplyScalar(distance).add(center));

    // Set the near and far planes of the camera
    camera.near = distance / 10; // This could be adjusted to be more dynamic
    camera.far = distance * 10; // Depending on the application's needs

    camera.updateProjectionMatrix();

    // Update the camera to look at the center of the object
    camera.lookAt(center);

    // Update the orbit controls target to rotate around the center of the object
    controls.target.copy(center);
    controls.update();
}



function centerAndScaleModel(model: THREE.Object3D, scaleRadius = 2.0) {
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const size = box.getSize(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const scale = scaleRadius / maxSize;
    model.scale.setScalar(scale);
}

function hideDropzone() {
    dropzone.style.display = 'none';
}

// Window resize event listener
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize dat.GUI
const gui = new dat.GUI();

// Add environment map intensity control
const envMapControls = {
    envMapIntensity: 1, // Default intensity
};

// Add the environment map intensity slider to the GUI
gui.add(envMapControls, 'envMapIntensity', 0, 2, 0.01).name('Env Map Intensity').onChange((value) => {
    // Update envMapIntensity for all relevant materials
    scene.traverse((obj) => {
        if (obj.isMesh && obj.material && obj.material.isMeshStandardMaterial) {
            obj.material.envMapIntensity = value;
            obj.material.needsUpdate = true;
        }
    });
});

const toneMappingOptions = {
    'Linear': THREE.NoToneMapping,
    'ACESFilmic': THREE.ACESFilmicToneMapping,
    'Cineon': THREE.CineonToneMapping,
    'Reinhard': THREE.ReinhardToneMapping,
};

// Object to hold the current tone mapping setting
const toneMappingControl = {
    toneMapping: 'ACESFilmic' // Default tone mapping
};

// Add tone mapping control
gui.add(toneMappingControl, 'toneMapping', Object.keys(toneMappingOptions)).name('Tone Mapping').onChange((value) => {
    renderer.toneMapping = toneMappingOptions[value];
    // Important: When changing tone mapping, materials need to be updated
    scene.traverse((obj) => {
        if (obj.material) {
            obj.material.needsUpdate = true;
        }
    });
});

const outputEncodingOptions = {
    'sRGB': THREE.sRGBEncoding,
    'Linear': THREE.LinearEncoding,
};

// Object to hold the current outputEncoding setting
const outputEncodingControl = {
    outputEncoding: 'sRGB' // Default output encoding
};

// Add output encoding control
gui.add(outputEncodingControl, 'outputEncoding', Object.keys(outputEncodingOptions)).name('Output Encoding').onChange((value) => {
    renderer.outputEncoding = outputEncodingOptions[value];
});

// Object to hold the current exposure setting, starting with a default value
const exposureControl = {
    exposure: 1, // Default exposure
};

// Add exposure control
gui.add(exposureControl, 'exposure', 0, 2, 0.01).name('Scene Exposure').onChange((value) => {
    renderer.toneMappingExposure = value;
});



const settings = {
    backgroundColor: '#ffffff', // Default white background
    backgroundIntensity: 1, // Default intensity (range 0-1)
    transparentBackground: false, // Transparency off by default
    envMapIntensity: 1, // Default environment map intensity
};

// Add the consolidated background color and intensity slider to the GUI
gui.addColor(settings, 'backgroundColor').name('Background Color').onChange(updateBackgroundColorIntensity);
gui.add(settings, 'backgroundIntensity', 0, 1, 0.01).name('Background Intensity').onChange(updateBackgroundColorIntensity);

function updateBackgroundColorIntensity() {
    // Ensure the function reacts to both color and intensity adjustments
    const baseColor = new THREE.Color(settings.backgroundColor);

    // Create a new color based on intensity
    // This approach blends the selected color with white or black based on the intensity
    let intensityColor = baseColor.clone();
    if (settings.backgroundIntensity <= 0.5) {
        // Blend towards black for lower intensities
        intensityColor.lerp(new THREE.Color(0x000000), 1 - settings.backgroundIntensity * 2);
    } else {
        // Blend towards white for higher intensities
        intensityColor = baseColor.clone().lerp(new THREE.Color(0xffffff), (settings.backgroundIntensity - 0.5) * 2);
    }

    if (!settings.transparentBackground) {
        scene.background = intensityColor;
    } else {
        // If the background is set to be transparent, this adjustment is not applied
        // However, it's important to have this logic ready for when the transparency is toggled off
        scene.background = intensityColor;
    }
}

// Ensure the function is called initially to set the initial background color and any time the settings change
updateBackgroundColorIntensity();

// Transparency toggle
gui.add(settings, 'transparentBackground').name('Transparent BG');

// Export button
gui.add({exportScene: () => exportSceneAsPNG()}, 'exportScene').name('Export PNG');

function exportSceneAsPNG() {
    // Preserve original renderer and camera settings
    const originalAspect = camera.aspect;
    const originalBackground = scene.background;
    const originalSize = { width: renderer.domElement.width, height: renderer.domElement.height };

    // Configure renderer for snapshot
    renderer.setSize(1200, 800);
    camera.aspect = 1200 / 800;
    camera.updateProjectionMatrix();

    if (settings.transparentBackground) {
        renderer.setClearColor(new THREE.Color(0x000000), 0); // Set clear color to black with 0 alpha for transparency
        scene.background = null; // Remove the scene background for a transparent snapshot
    } else {
        renderer.setClearColor(new THREE.Color(settings.backgroundColor), 1); // Use the selected background color
        scene.background = new THREE.Color(settings.backgroundColor);
    }

    // Render the scene
    renderer.render(scene, camera);

    // Capture and save the image
    const dataURL = renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'scene-snapshot.png';
    link.href = dataURL;
    link.click();

    // Restore original settings
    renderer.setSize(originalSize.width, originalSize.height);
    camera.aspect = originalAspect;
    camera.updateProjectionMatrix();
    renderer.setClearColor(new THREE.Color(0x000000), 1); // Reset clear color if needed
    scene.background = originalBackground; // Restore the original background
    renderer.render(scene, camera); // Re-render the scene with original settings
}

// Add button in dat.GUI to export dimensions as JSON
gui.add({exportDimensions: function() {
    const filename = "boundingBoxDimensions.json";
    const json = JSON.stringify(boundingBoxDimensions);
    const blob = new Blob([json], {type: "application/json"});
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}}, 'exportDimensions').name('Export Dimensions');

// Add button in dat.GUI to toggle bounding box visibility
gui.add({toggleBoundingBox: function() {
    if (boundingBoxHelper) boundingBoxHelper.visible = !boundingBoxHelper.visible;
}}, 'toggleBoundingBox').name('Toggle Bounding Box');

