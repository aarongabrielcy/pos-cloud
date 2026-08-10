import { Inject, Injectable } from "@nestjs/common";
import type { License } from "../../domain/license";
import { LicenseId } from "../../domain/license-id";
import { LICENSE_REPOSITORY, type LicenseRepository } from "../../domain/license-repository.port";

@Injectable()
export class GetLicenseByIdUseCase {
  constructor(@Inject(LICENSE_REPOSITORY) private readonly licenses: LicenseRepository) {}

  /** Returns null when not found - "not found" is a normal query outcome, not an exceptional one. */
  async execute(id: string): Promise<License | null> {
    return this.licenses.findById(LicenseId.of(id));
  }
}
