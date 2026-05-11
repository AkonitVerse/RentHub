import { Global, Module } from '@nestjs/common';
import { SecretCipherService } from './secret-cipher';

/**
 * Глобальный модуль шифрования секретов at-rest.
 *
 * Помечен @Global, чтобы SecretCipherService был доступен в любом модуле без
 * необходимости импортировать CryptoModule в каждом — секреты могут шифроваться
 * в любой точке системы (SMTP-пароль, в будущем — API-ключи интеграций и т.п.).
 */
@Global()
@Module({
  providers: [SecretCipherService],
  exports: [SecretCipherService],
})
export class CryptoModule {}
