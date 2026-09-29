// 只打包大地图用到的 three.js 部分，输出 vendor/three.min.js（window.THREE）
export {
  WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, OrthographicCamera, Color, Fog, Vector2, Vector3, Matrix4, Object3D, Group, Mesh, InstancedMesh,
  PlaneGeometry, BoxGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, SphereGeometry, BufferGeometry, BufferAttribute, Float32BufferAttribute, InstancedBufferAttribute,
  MeshLambertMaterial, MeshBasicMaterial, MeshDepthMaterial, MeshToonMaterial, ShaderMaterial, CanvasTexture, Texture, DataTexture,
  CapsuleGeometry, TorusGeometry, LatheGeometry, OctahedronGeometry, TubeGeometry, ShapeGeometry, ExtrudeGeometry, Shape, CatmullRomCurve3, QuadraticBezierCurve3,
  Points, Quaternion, Euler, MathUtils, AdditiveBlending, NormalBlending, BackSide, RedFormat, Vector4,
  HemisphereLight, DirectionalLight, AmbientLight, PointLight,
  SRGBColorSpace, NearestFilter, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, ClampToEdgeWrapping, DoubleSide, FrontSide, PCFSoftShadowMap, PCFShadowMap, RGBADepthPacking, NoToneMapping, ACESFilmicToneMapping, HalfFloatType, UnsignedByteType,
} from 'three';
export { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// 会动的 3D 怪兽（?art=3d，art/mon3d/*.glb 带骨骼和动作）
export { AnimationMixer, LoopOnce, LoopRepeat, SkinnedMesh } from 'three';
export { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
// 发布版怪兽模型（assets/mon3d/*.glb）用 meshopt 压缩过，要这个解码器
export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
