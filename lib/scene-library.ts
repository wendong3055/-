export type SceneReference = {
  id: string; name: string; category: string; image: string; description: string;
  width: number; height: number;
  author: string; source: string; license: string; licenseUrl: string;
};

// Curated reference images are bundled with the site, never hotlinked or added
// to the artwork asset table. Each entry retains its source and image license.
// width/height are the real intrinsic pixel size of the bundled file: the card
// reserves space with them, and the server uses them to check that the uploaded
// reference really is the selected scene.
const sourceRoot = 'https://github.com/ErfanMo77/gltf-research-scenes/tree/f61371ee556a5e1f0e5c697bcbdfb95ca756bcfd/scenes';
const sharedLicense = { license: 'CC BY 3.0（署名使用）', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/' };
export const sceneReferences: SceneReference[] = [
  { id: 'github-modern-hall', name: '现代木色门厅', category: '玄关门厅', image: '/scenes/github-interiors/modern-hall.png', description: '浅色墙面、暖色石材地面与悬浮木楼梯；参考门厅采光，在平整地面留出产品位置', width: 1024, height: 1024, author: 'NewSee2l035', source: `${sourceRoot}/modern-hall/source`, ...sharedLicense },
  { id: 'github-grey-white-room', name: '灰白自然光客厅', category: '客厅', image: '/scenes/github-interiors/living-room.png', description: '深灰墙面、白色拱窗与木地板，自然侧光；参考室内明暗层次，调整原有家具以完整展示新品', width: 1280, height: 720, author: 'Wig42', source: `${sourceRoot}/living-room/source`, ...sharedLicense },
  { id: 'github-white-room', name: '明亮白色客厅', category: '客厅', image: '/scenes/github-interiors/living-room-2.png', description: '白色家具、浅灰墙面与木地板，柔和窗光；仅参考空间与光线，减少原有家具，避免遮挡产品', width: 1280, height: 720, author: 'Jay-Artist', source: `${sourceRoot}/living-room-2/source`, ...sharedLicense },
  { id: 'github-wood-staircase', name: '原木楼梯过厅', category: '楼梯过厅', image: '/scenes/github-interiors/staircase.png', description: '原木地板、木扶手与复古拱形过厅；参考温暖木色和纵深，在楼梯外平整地面摆放产品', width: 720, height: 1280, author: 'Wig42', source: `${sourceRoot}/staircase/source`, ...sharedLicense },
];
export function findScene(id: string | undefined) { return sceneReferences.find(scene => scene.id === id); }
export function sceneReferenceBrief(scene: SceneReference, referenceNumber: number) {
  return `场景参考优先要求：图${referenceNumber}是“${scene.name}”室内环境参考，仅借鉴空间、地面、墙面、光线和机位，不复制其中家具为本产品，不把场景印进画芯。${scene.description}。将已选新品完整放入合理位置，留出落地空间，其他家具不能遮挡产品；严格保留前两张参考中的产品结构、画芯与所选木色，不改变门、抽屉、脚轮数量。输出带真实场景背景，不用白底，不添加水印。`;
}

// A selected scene supplies the room background, so a transparent output would
// discard it. The client disables that option and the server rejects the
// request from this one rule, so the two can never drift apart again.
export function sceneRequiresOpaqueBackground(hasScene: boolean, background: string) {
  return hasScene && background === 'transparent';
}

// Intrinsic PNG size from the IHDR chunk, or null when the bytes are not a PNG.
// Blob.slice keeps this a 24-byte read instead of buffering the whole upload.
export function pngPixelSize(bytes: Uint8Array) {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
