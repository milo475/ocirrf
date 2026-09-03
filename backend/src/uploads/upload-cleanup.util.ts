import { unlink } from 'node:fs/promises';

/**
 * БАЙРШУУЛСАН ФАЙЛЫН ЦЭВЭРЛЭГЭЭ.
 *
 * Multer файлыг handler ажиллахаас ӨМНӨ дискэнд бичдэг. Тиймээс
 * validation (400), эрх (403), «олдсонгүй» (404) зэрэг алдаанд файл
 * дискэн дээр orphan үлдэж, (а) диск дүүргэх, (б) UploadAccessGuard-ийн
 * «хаана ч холбогдоогүй файл нэвтэрсэн хүнд нээлттэй» цонхоор бусад
 * байгууллагын хэрэглэгчид уншигдах боломж үүсгэж байв.
 */
export async function discardUpload(file?: { path?: string }): Promise<void> {
  if (!file?.path) return;
  try {
    await unlink(file.path);
  } catch {
    // аль хэдийн устсан (assertRealImage г.м.) — асуудалгүй
  }
}

/** Handler-ийг ажиллуулж, алдаа гарвал файлыг устгаад алдааг цааш шиднэ */
export async function withUploadCleanup<T>(
  file: { path?: string } | undefined,
  fn: () => Promise<T> | T,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    await discardUpload(file);
    throw e;
  }
}
