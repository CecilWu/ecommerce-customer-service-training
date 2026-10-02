import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requestUrl } from "@/lib/http";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SIGNATURE_DIR = path.join(process.cwd(), "public", "images", "signatures");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPng(buffer: Buffer) {
  return buffer.length > 32 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function pngHasTransparency(buffer: Buffer) {
  if (!isPng(buffer)) return false;

  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataOffset = offset + 8;

    if (type === "IHDR") {
      const colorType = buffer[dataOffset + 9];
      if (colorType === 4 || colorType === 6) return true;
    }

    if (type === "tRNS") return true;
    if (type === "IEND") break;

    offset += length + 12;
  }

  return false;
}

export async function POST(request: Request) {
  const user = await requireUser(["MASTER"]);
  const formData = await request.formData();
  const file = formData.get("signature");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "请上传师父签章PNG图片" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "签章图片不能超过2MB" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isPng(buffer)) {
    return NextResponse.json({ error: "签章图片必须是PNG格式" }, { status: 400 });
  }

  if (!pngHasTransparency(buffer)) {
    return NextResponse.json({ error: "请上传带透明背景的PNG签章图片" }, { status: 400 });
  }

  await mkdir(SIGNATURE_DIR, { recursive: true });

  const filename = `${user.id}-${Date.now()}.png`;
  const publicPath = `/images/signatures/${filename}`;
  await writeFile(path.join(SIGNATURE_DIR, filename), buffer);

  await prisma.user.update({
    where: { id: user.id },
    data: { signatureImagePath: publicPath }
  });

  return NextResponse.redirect(requestUrl(request, "/mentor/signature?signature=uploaded"), { status: 303 });
}
