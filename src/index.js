import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three//examples/jsm/lines/LineMaterial.js';

import { ConditionalEdgesGeometry } from './shaders/ConditionalEdgesGeometry.js';
import { ConditionalLineSegmentsGeometry } from './shaders/ConditionalLineSegmentsGeometry.js';
import { ConditionalLineMaterial } from './shaders/ConditionalLineMaterial.js';

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import createURL from './utils/createURL';
import createGltfURL from './utils/createGltfURL';


// globals
var params = {
  lineColor: '#000000',
  threshold: 40,
  fov: 40,
  thickness: 1,
  useShader: true,
  modelType: 'gltf'
};
let camera, scene, renderer, controls, edgesModel, originalModel, backgroundModel, conditionalModel, originalModelWithTex, gui;
// Default Model URL: https://sketchfab.com/3d-models/japanese-classroom-2a1e3b294c1e4e91bed794bfa520c4f4
let modelURL = './resources/japanese_classroom/scene.gltf';

// For Update OrbitControls Center
let lengthFromCenter, prev_lengthFromCenter;

// Loader
const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const objLoader = new OBJLoader();

// Loading CSS
const loading = document.querySelector( '.loading' );
// Default Model Credit
const credit = document.querySelector( '.credit' );

init();
render();


async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color( 0xffffff );

  camera = new THREE.PerspectiveCamera( params.fov, window.innerWidth / window.innerHeight, 0.1, 2000 );
  camera.position.set( -1, 0.5, 2 ).multiplyScalar( 0.75 );
  scene.add( camera );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true 
  } );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  const dirLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
  dirLight.position.set( 5, 10, 5 );
  scene.add( dirLight );

  controls = new OrbitControls( camera, renderer.domElement );
  controls.maxDistance = 200;

  window.addEventListener( 'resize', onWindowResize, false );

  // Default Model
  await loadModel(params.modelType);
  loadFinish()
  // Set Event for Drag and Drop Models
  loadDropModel();

  initGui();
}


function loadDropModel() {
  const dropZoneElement = document.querySelector("body");
  dropZoneElement.ondragenter = function (event) {
    event.preventDefault();
  };
  dropZoneElement.ondragover = function (event) {
    event.preventDefault();
  };
  dropZoneElement.ondragleave = function (event) {
    event.preventDefault();
  };
  dropZoneElement.ondrop = async function (event) {
    console.log('load start')
    loadStart()
    event.preventDefault();

    if (params.modelType === 'glb' || params.modelType === 'fbx' || params.modelType === 'obj') {
      modelURL = createURL(event, params.modelType);
    } else if (params.modelType === 'gltf') {
      modelURL = await createGltfURL(event);
    }
    await loadModel(params.modelType);
    loadFinish()
    removeCredit()
    console.log('load finished')
  };
};


function loadStart() {
  loading.classList.remove( 'hide' );
}
 
function loadFinish() {
  loading.classList.add( 'hide' );
}

function removeCredit() {
  credit.classList.add( 'hide' );
}

function loadModel(modelType) {
  let loadPromise;
  if (modelType === 'glb' || modelType === 'gltf') {
    loadPromise = new Promise(function(resolve) {
      gltfLoader.load(modelURL, (gltf) => {
        // For Line
        originalModel = mergeObject( gltf.scene );
        updateModel();
        // For Original with Texture
        originalModelWithTex = fixPosition(gltf.scene);
        scene.add(originalModelWithTex);
        resolve()
      });
    });
  } else if (modelType === 'fbx') {
    loadPromise = new Promise(function(resolve) {
      fbxLoader.load(modelURL, (fbx) => {
        // For Line
        originalModel = mergeObject( fbx );
        updateModel();
        // For Original with Texture
        originalModelWithTex = fixPosition(fbx);
        scene.add(originalModelWithTex);
        resolve()
      });
    });
  } else if (modelType === 'obj') {
    loadPromise = new Promise(function(resolve) {
      objLoader.load(modelURL, (obj) => {
        // For Line
        originalModel = mergeObject( obj );
        updateModel();
        // For Original with Texture
        originalModelWithTex = fixPosition(obj);
        scene.add(originalModelWithTex);
        resolve()
      });
    });
  }
  return loadPromise
}


// Centering model 
// reference: https://discourse.threejs.org/t/centering-a-gltf-geometry/6841
function fixPosition( object ) {
  const box = new THREE.Box3().setFromObject( object );
  const center = box.getCenter( new THREE.Vector3() );
  object.position.x += ( object.position.x - center.x );
  object.position.y += ( object.position.y - center.y );
  object.position.z += ( object.position.z - center.z );
  return object
}


function render() {
  requestAnimationFrame( render );

  if ( backgroundModel ) {
    renderBackgroundModel();
  }
  if ( conditionalModel ) {
    renderConditonlaModel();
  }
  if ( edgesModel ) {
    renderEdgeModel();
  }
  if ( originalModelWithTex) {
    renderOriginalModelWithTex();
  }

  // Update the center coordinates because the camera gets stuck near the center.
  lengthFromCenter = update_center_position(lengthFromCenter, prev_lengthFromCenter, camera, controls);
  prev_lengthFromCenter = lengthFromCenter;
  controls.update();

  // Updata Camera FOV
  if (camera.fov != params.fov) {
    camera.fov = params.fov;
    camera.updateProjectionMatrix(params.fov);
  }

  renderer.render( scene, camera );
}


function renderBackgroundModel() {
  backgroundModel.traverse( c => {
    if ( c.material && c.material.resolution ) {
      renderer.getSize( c.material.resolution );
      c.material.resolution.multiplyScalar( window.devicePixelRatio );
    }
    if ( c.material ) {
      c.visible = params.useShader;
    }
  });
}


function renderConditonlaModel() {
  conditionalModel.traverse( c => {
    if ( c.material && c.material.resolution ) {
      renderer.getSize( c.material.resolution );
      c.material.resolution.multiplyScalar( window.devicePixelRatio );
      c.material.linewidth = params.thickness;
    }
    if ( c.material ) {
      c.visible = params.useShader;
      c.material.uniforms.diffuse.value.set( params.lineColor );
    }
  });
}


function renderEdgeModel() {
  edgesModel.traverse( c => {
    if ( c.material && c.material.resolution ) {
      renderer.getSize( c.material.resolution );
      c.material.resolution.multiplyScalar( window.devicePixelRatio );
      c.material.linewidth = params.thickness;
    }
    if ( c.material ) {
      c.visible = params.useShader;
      c.material.color.set( params.lineColor );
    }
  } );
}


function renderOriginalModelWithTex() {
  originalModelWithTex.traverse( c => {
    if ( c.material && c.material.resolution ) {
      renderer.getSize( c.material.resolution );
      c.material.resolution.multiplyScalar( window.devicePixelRatio );
    }
    if ( c.material ) {
      c.visible = !params.useShader;
    }
  });
}


function update_center_position(lengthFromCenter, prev_lengthFromCenter, camera, controls) {
  let directionVector = [0.0, 0.0, 0.0];
  directionVector[0] = controls.target.x - camera.position.x;
  directionVector[1] = controls.target.y - camera.position.y;
  directionVector[2] = controls.target.z - camera.position.z;
  lengthFromCenter = Math.sqrt(
    Math.pow(directionVector[0], 2) + 
    Math.pow(directionVector[1], 2) + 
    Math.pow(directionVector[2], 2)
  );

  if (
      Math.abs(lengthFromCenter - prev_lengthFromCenter) < 0.5 &&  // Exclude rotation and parallel movement
      lengthFromCenter < 1
  ) {
    // Move the center to the extension of the direction
    controls.target.x = camera.position.x + directionVector[0] * 3;
    controls.target.y = camera.position.y + directionVector[1] * 3;
    controls.target.z = camera.position.z + directionVector[2] * 3;
  }
  lengthFromCenter;
  return lengthFromCenter;
}


function updateModel() {
  initEdgesModel();
  initBackgroundModel();
  initConditionalModel();
}


function mergeObject( object ) {
  object.updateMatrixWorld( true );
  const geometry = [];
  object.traverse( c => {
    if ( c.isMesh ) {
      const g = c.geometry;
      g.applyMatrix4( c.matrixWorld );
      for ( const key in g.attributes ) {
        if ( key !== 'position' && key !== 'normal' ) {
          g.deleteAttribute( key );
        }
      }
      geometry.push( g.toNonIndexed() );
    }
  } );

  const mergedGeometries = BufferGeometryUtils.mergeBufferGeometries( geometry, false );
  const mergedGeometry = BufferGeometryUtils.mergeVertices( mergedGeometries ).center();

  const group = new THREE.Group();
  const mesh = new THREE.Mesh( mergedGeometry );
  group.add( mesh );
  return group;
}


function initBackgroundModel() {
  if ( backgroundModel ) {
    backgroundModel.parent.remove( backgroundModel );
    backgroundModel.traverse( c => {
      if ( c.isMesh ) {
        c.material.dispose();
      }
    } );
  }

  if ( ! originalModel ) {
    return;
  }
  backgroundModel = originalModel.clone();
  backgroundModel.traverse( c => {
    if ( c.isMesh ) {
      c.material = new THREE.MeshBasicMaterial( { color: 0xffffff } );
      c.material.polygonOffset = true;
      c.material.polygonOffsetFactor = 1;
      c.material.polygonOffsetUnits = 1;
      c.renderOrder = 2;
    }
  } );
  scene.add( backgroundModel );
}


function initEdgesModel() {
  // remove any previous model
  if ( edgesModel ) {
    edgesModel.parent.remove( edgesModel );
    edgesModel.traverse( c => {
      if ( c.isMesh ) {
        if ( Array.isArray( c.material ) ) {
          c.material.forEach( m => m.dispose() );
        } else {
          c.material.dispose();
        }
      }
    } );
  }

  // early out if there's no model loaded
  if ( ! originalModel ) {
    return;
  }

  // store the model and add it to the scene to display
  // behind the lines
  edgesModel = originalModel.clone();
  scene.add( edgesModel );

  const meshes = [];
  edgesModel.traverse( c => {
    if ( c.isMesh ) {
      meshes.push( c );
    }
  } );

  for ( const key in meshes ) {
    const mesh = meshes[ key ];
    const parent = mesh.parent;

    let lineGeom;
    lineGeom = new THREE.EdgesGeometry( mesh.geometry, params.threshold );
    const thickLineGeom = new LineSegmentsGeometry().fromEdgesGeometry( lineGeom );
    const thickLines = new LineSegments2( thickLineGeom, new LineMaterial( { color: params.lineColor, linewidth: 3 } ) );
    thickLines.position.copy( mesh.position );
    thickLines.scale.copy( mesh.scale );
    thickLines.rotation.copy( mesh.rotation );

    parent.remove( mesh );
    parent.add( thickLines );
  }
}


function initConditionalModel() {
  // remove the original model
  if ( conditionalModel ) {
    conditionalModel.parent.remove( conditionalModel );
    conditionalModel.traverse( c => {
      if ( c.isMesh ) {
        c.material.dispose();
      }
    } );
  }

  // if we have no loaded model then exit
  if ( ! originalModel ) {
    return;
  }

  conditionalModel = originalModel.clone();
  scene.add( conditionalModel );

  // get all meshes
  const meshes = [];
  conditionalModel.traverse( c => {
    if ( c.isMesh ) {
      meshes.push( c );
    }
  } );

  for ( const key in meshes ) {
    const mesh = meshes[ key ];
    const parent = mesh.parent;

    // Remove everything but the position attribute
    const mergedGeom = mesh.geometry.clone();
    for ( const key in mergedGeom.attributes ) {
      if ( key !== 'position' ) {
        mergedGeom.deleteAttribute( key );
      }
    }

    // Create the conditional edges geometry and associated material
    const lineGeom = new ConditionalEdgesGeometry( BufferGeometryUtils.mergeVertices( mergedGeom ) );
    const thickLineGeom = new ConditionalLineSegmentsGeometry().fromConditionalEdgesGeometry( lineGeom );
    const thickLines = new LineSegments2( thickLineGeom, new ConditionalLineMaterial( { color: params.lineColor, linewidth: 2 } ) );
    thickLines.position.copy( mesh.position );
    thickLines.scale.copy( mesh.scale );
    thickLines.rotation.copy( mesh.rotation );

    parent.remove( mesh );
    parent.add( thickLines );
  }
}


function onWindowResize() {
  var width = window.innerWidth;
  var height = window.innerHeight;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize( width, height );
  renderer.setPixelRatio( window.devicePixelRatio );
}


function takePicture() {
  const saveAsFileName = 'sample.png'
  var url = renderer.domElement.toDataURL();
  var link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('target', '_blank');
  link.setAttribute('download', saveAsFileName);
  link.click();
}


function initGui() {
  if ( gui ) {
    gui.destroy();
  }

  gui = new dat.GUI();
  gui.width = 300;

  gui.add( params, 'threshold' )
    .min( 0 )
    .max( 120 )
    .onChange( initEdgesModel );
  gui.add( params, 'thickness', 0, 5 );
  gui.add( params, 'fov', 0, 180 );
  gui.add( params, 'useShader' );
  gui.add( params, 'modelType', [ 'gltf', 'glb', 'fbx', 'obj' ] ).onChange ( loadDropModel );

  const obj = { Download:takePicture };
  gui.add(obj,'Download');
  gui.open();

}