import { NextRequest, NextResponse } from 'next/server';
import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid'; // 用于生成唯一文件名

// 初始化 MinIO Client
// 这些环境变量需要在你的 .env.local 或服务器环境变量中设置 (不需要 NEXT_PUBLIC_ 前缀)
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT || '443'),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!,
});

const bucketName = process.env.MINIO_BUCKET_NAME!;
// 确保 MINIO_ENDPOINT 不包含协议头，例如 'objectstorageapi.bja.sealos.run'
const publicUrlBase = `https://${process.env.MINIO_ENDPOINT}/${bucketName}`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '文件未找到' }, { status: 400 });
    }

    // 检查存储桶是否存在，如果不存在则尝试创建
    try {
      const bucketExists = await minioClient.bucketExists(bucketName);
      if (!bucketExists) {
        await minioClient.makeBucket(bucketName, 'us-east-1'); // 默认区域，可按需修改
        console.log(`Bucket ${bucketName} created successfully.`);
        // 注意：你可能需要在这里或通过 Sealos 控制台设置存储桶的公共读取策略
        // 例如:
        // const policy = `{\\"Version\\":\\"2012-10-17\\",\\"Statement\\":[{\\"Effect\\":\\"Allow\\",\\"Principal\\":{\\"AWS\\":[\\"*\\"]},\\"Action\\":[\\"s3:GetObject\\"],\\"Resource\\":[\\"arn:aws:s3:::${bucketName}/*\\"]}]}`;
        // await minioClient.setBucketPolicy(bucketName, policy);
        // console.log(`Public read policy set for bucket ${bucketName}`);
      }
    } catch (err) {
      console.error('Error checking or creating bucket:', err);
      // 根据你的需求，如果存储桶检查/创建失败是严重错误，可以在这里返回错误响应
      // return NextResponse.json({ error: '存储桶操作失败', details: (err as Error).message }, { status: 500 });
    }
    
    const fileExtension = file.name.split('.').pop() || 'bin'; // 提供默认扩展名
    const fileName = `${uuidv4()}.${fileExtension}`; // 生成唯一文件名

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await minioClient.putObject(bucketName, fileName, buffer, file.size, {
      'Content-Type': file.type,
    });

    const fileUrl = `${publicUrlBase}/${fileName}`;

    return NextResponse.json({ success: true, fileUrl });
  } catch (error: any) {
    console.error('文件上传失败:', error);
    return NextResponse.json({ error: '文件上传失败', details: error.message || '未知错误' }, { status: 500 });
  }
} 