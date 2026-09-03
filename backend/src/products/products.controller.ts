import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { diskStorage, memoryStorage } from 'multer';
import { UPLOADS_DIR } from '../uploads.config';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';
import { assertRealImage } from '../uploads/image-content.util';

/** Зөвшөөрөгдсөн зургийн төрлүүд — өргөтгөлийг MIME-ээс тодорхойлно */
const IMAGE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Барааны зургийг таагдашгүй нэрээр UPLOADS_DIR-д хадгална */
const imageStorage = diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) => {
    cb(
      null,
      randomBytes(16).toString('hex') + (IMAGE_MIME[file.mimetype] ?? '.jpg'),
    );
  },
});

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /** DRIVER бараа харахгүй — эрхийн матрицын дагуу */
  @Get()
  @RequirePermission(PERM.INVENTORY_VIEW)
  findAll(@Query() query: QueryProductsDto, @CurrentUser() user: AuthUser) {
    return this.productsService.findAll(query, user);
  }

  /** V4-12: импортын CSV загвар (UTF-8 BOM) — ':id'-ээс ӨМНӨ байх ёстой */
  @Get('import-template.csv')
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  importTemplate(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="import-template.csv"',
    );
    res.send(this.productsService.importTemplate());
  }

  /** V4-12: CSV импорт — мөр бүрийн үр дүн {created, updated, errors} */
  @Post('import')
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  importCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.importCsv(file?.buffer, user);
  }

  @Get(':id')
  @RequirePermission(PERM.INVENTORY_VIEW)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productsService.findOne(id, user);
  }

  @Post()
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  /**
   * Барааны зураг байршуулах (V5). Нийтийн захиалгын хуудсанд бараа
   * зурагтайгаа харагдах шаардлагатай тул зургийг ЭНД оруулна.
   */
  @Post(':id/image')
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: imageStorage,
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        cb(null, file.mimetype in IMAGE_MIME);
      },
    }),
  )
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (file) assertRealImage(file.path);
    return this.productsService.setImage(id, file?.filename);
  }

  @Delete(':id')
  @RequirePermission(PERM.INVENTORY_ADJUSTMENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
