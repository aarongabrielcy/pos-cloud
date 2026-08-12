import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Length } from "class-validator";

export class LoginRequestDto {
  @ApiProperty({ format: "email", example: "admin@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "correct horse battery staple", minLength: 1, maxLength: 256 })
  @IsString()
  @Length(1, 256)
  password!: string;
}
