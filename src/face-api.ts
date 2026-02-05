// 简化的人脸检测接口
let api: any = null;

export async function detectFaces(imageData: string): Promise<{ x: number; y: number; w: number; h: number }[]> {
  try {
    if (!api) {
      const faceapi = await import('face-api.js');
      await Promise.all([
        faceapi.loadTinyFaceDetectorModel('/models'),
        faceapi.loadFaceLandmarkModel('/models'),
      ]);
      api = faceapi;
    }

    const img = new Image();
    img.src = imageData;
    await new Promise(r => img.onload = r);

    const det = await api.detectAllFaces(img, new api.TinyFaceDetectorOptions());
    return det.map((d: any) => ({ x: d.box.x, y: d.box.y, w: d.box.width, h: d.box.height }));
  } catch (e) {
    console.warn('人脸检测失败，使用默认', e);
    return [{ x: 100, y: 50, w: 200, h: 250 }];
  }
}
