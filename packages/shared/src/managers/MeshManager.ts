import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

/**
 * 支持的模型文件类型
 */
export type ModelFileType = 'gltf' | 'glb' | 'obj';

/**
 * MeshManager (Singleton)
 * 负责 3D 模型的加载、归一化处理（居中/缩放）以及内存深度销毁。
 */
export class MeshManager {
  private static instance: MeshManager | null = null;
  
  private gltfLoader: GLTFLoader;
  private objLoader: OBJLoader;
  private dracoLoader: DRACOLoader;

  private constructor() {
    this.gltfLoader = new GLTFLoader();
    this.objLoader = new OBJLoader();
    
    // 初始化 Draco 解码器
    // 默认使用 CDN，生产环境建议指向本地 /public/draco/ 目录
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.dracoLoader.setDecoderConfig({ type: 'js' });
    this.dracoLoader.preload();
    
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MeshManager {
    if (!MeshManager.instance) {
      MeshManager.instance = new MeshManager();
    }
    return MeshManager.instance;
  }

  /**
   * 配置 Draco 解码器路径 (例如: '/draco/')
   */
  public setDracoDecoderPath(path: string): void {
    this.dracoLoader.setDecoderPath(path);
  }

  /**
   * 异步加载模型
   * @param url 模型 URL
   * @param type 模型类型
   * @returns 加载并封装好的 THREE.Group
   */
  public loadModel(url: string, type: ModelFileType): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      const onSuccess = (data: any) => {
        let modelObject: THREE.Object3D;

        // 统一提取模型对象
        if (type === 'gltf' || type === 'glb') {
          modelObject = data.scene;
        } else {
          // OBJ 返回的就是 Group
          modelObject = data;
        }

        // 启用阴影
        modelObject.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        // 创建一个包装容器，方便后续整体操作
        const wrapper = new THREE.Group();
        wrapper.add(modelObject);
        
        resolve(wrapper);
      };

      const onError = (err: any) => {
        console.error(`[MeshManager] Load Error (${type}): ${url}`, err);
        reject(err);
      };

      try {
        if (type === 'obj') {
          this.objLoader.load(url, onSuccess, undefined, onError);
        } else {
          this.gltfLoader.load(url, onSuccess, undefined, onError);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 模型归一化：自动居中并缩放
   * @param object 目标对象
   * @param targetSize 目标归一化尺寸（例如限制在 1 单位大小内）
   */
  public normalize(object: THREE.Object3D, targetSize: number = 1.0): void {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    // 1. 居中校正
    // 将对象位置向中心点的反方向移动，使其视觉中心回到 (0,0,0)
    object.position.x -= center.x;
    object.position.y -= center.y;
    object.position.z -= center.z;

    // 2. 自适应缩放
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > 0) {
      const scaleFactor = targetSize / maxDimension;
      object.scale.multiplyScalar(scaleFactor);
    }

    // 更新矩阵，确保后续 Raycaster 检测准确
    object.updateMatrix();
    object.updateMatrixWorld(true);
  }

  /**
   * 深度清理内存（Geometry, Material, Texture）
   * @param object 需要销毁的对象
   */
  public dispose(object: THREE.Object3D): void {
    if (!object) return;

    object.removeFromParent();

    object.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        // 1. 清理 Geometry
        if (node.geometry) {
          node.geometry.dispose();
        }

        // 2. 清理 Material
        if (node.material) {
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          
          materials.forEach((mat: THREE.Material) => {
            // 清理 Material 中的所有 Texture
            this.disposeTexturesInMaterial(mat);
            // 销毁 Material 自身
            mat.dispose();
          });
        }
      }
    });
  }

  /**
   * 辅助：遍历并销毁材质中的纹理
   */
  private disposeTexturesInMaterial(material: any): void {
    const textureProperties = [
      'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 
      'emissiveMap', 'envMap', 'lightMap', 'metalnessMap', 
      'normalMap', 'roughnessMap'
    ];

    textureProperties.forEach((prop) => {
      if (material[prop] && typeof material[prop].dispose === 'function') {
        material[prop].dispose();
      }
    });
  }
}
