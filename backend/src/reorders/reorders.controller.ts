import { Controller, Get } from '@nestjs/common';
import { PERM } from '../permissions/permission-keys';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { ReordersService } from './reorders.service';

/**
 * Давтан захиалгын дараалал.
 *
 * ЭРХ: `customers.view` — үйлчлүүлэгчийн нэр, утас, худалдан авалтын
 * түүхийг задалдаг тул худалдан авагчийн мэдээлэл хардаг эрхтэй
 * ижил хамгаалалт (/customers/history-тэй адил).
 */
@Controller('reorders')
export class ReordersController {
  constructor(private readonly reorders: ReordersService) {}

  @Get()
  @RequirePermission(PERM.CUSTOMERS_VIEW)
  due() {
    return this.reorders.due();
  }
}
