// 只打包大地图用到的 three.js 部分，输出 vendor/three.min.js（window.THREE）
export {
  WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, OrthographicCamera, Color, Fog, Vector2, Vector3, Matrix4, Object3D, Group, Mesh, InstancedMesh,
  PlaneGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, SphereGeometry, BufferGeometry, BufferAttribute, Float32BufferAttribute, InstancedBufferAttribute,
  MeshLambertMaterial, MeshBasicMaterial, MeshDepthMaterial, ShaderMaterial, CanvasTexture, Texture,
  HemisphereLight, DirectionalLight, AmbientLight, PointLight,
  SRGBColorSpace, NearestFilter, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, ClampToEdgeWrapping, DoubleSide, FrontSide, PCFSoftShadowMap, PCFShadowMap, RGBADepthPacking, NoToneMapping, ACESFilmicToneMapping, HalfFloatType, UnsignedByteType,
} from 'three';
export { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
