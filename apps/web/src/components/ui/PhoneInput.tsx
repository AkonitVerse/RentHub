import { forwardRef, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatPhoneInput, normalizePhoneDigits, canonicalPhone } from '@/lib/utils/phone';

type InputProps = React.ComponentProps<typeof Input>;

interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'inputMode'> {
  /** Текущее значение (любой формат — компонент сам отформатирует). */
  value?: string;
  /**
   * Колбэк при изменении. Передаёт каноническую форму:
   *   - "" если ещё не 11 цифр (форма валидна — должна это учитывать),
   *   - "+7XXXXXXXXXX" если введено 11 цифр.
   * Также передаётся «сырой» отформатированный текст (для контролируемых компонентов).
   */
  onChange?: (canonical: string, formatted: string) => void;
}

/**
 * Подсказка-формат, показывается через HTML placeholder когда поле пустое
 * и не в фокусе. Видно ровно тогда, когда юзер ещё не начал заполнять.
 */
const PLACEHOLDER = '+7 (***) ***-**-**';

/**
 * Поле ввода российского телефона с авто-маской.
 *
 * Поведение пустого поля:
 *  - Без фокуса и без значения → отображается placeholder "+7 (***) ***-**-**"
 *    как подсказка формата (поле физически пустое, чтобы placeholder вообще
 *    был виден — у HTML это работает только когда value === '').
 *  - Клик / фокус → подставляется префикс "+7 " и курсор встаёт после, юзер
 *    сразу набирает цифры дальше. Это исключает «возню» с тем, чтобы
 *    самостоятельно вводить +7.
 *  - Снятие фокуса при пустом или только-префиксном значении → возвращаем
 *    поле в полностью пустое состояние, чтобы placeholder снова появился.
 *
 * Прочее:
 *  - Принимает любой ввод, оставляет только цифры
 *  - Ведущая 8 автоматически становится 7
 *  - Максимум 11 цифр (физически нельзя ввести больше)
 *  - Отображается как +7 (XXX) XXX-XX-XX по мере ввода
 *
 * Использование с react-hook-form:
 *   <Controller
 *     name="phone"
 *     control={control}
 *     render={({ field }) => (
 *       <PhoneInput value={field.value} onChange={(canonical) => field.onChange(canonical)} />
 *     )}
 *   />
 *
 * Или через ref + watch:
 *   <PhoneInput value={watch('phone')} onChange={(c) => setValue('phone', c)} />
 */
export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value = '', onChange, ...rest }, ref) => {
    // Если value пришёл уже заполненный (редактирование профиля), отображаем
    // его в каноническом виде. Если пустой — оставляем пустым, чтобы placeholder
    // показал маску формата.
    const [text, setText] = useState(() => (value ? formatPhoneInput(value) : ''));
    const isFocusedRef = useRef(false);

    // Синхронизация при внешнем изменении value (форма сбросилась, профиль
    // загрузился и т.п.) — но только когда поле НЕ в фокусе. Иначе при
    // удалении одного символа из полного номера canonicalPhone() мгновенно
    // станет '' и поле моргнёт в '+7 ', сбивая курсор юзеру.
    useEffect(() => {
      if (isFocusedRef.current) return;
      setText(value ? formatPhoneInput(value) : '');
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = formatPhoneInput(e.target.value);
      setText(next);
      const digits = normalizePhoneDigits(next);
      onChange?.(canonicalPhone(next) || (digits.length === 11 ? `+${digits}` : ''), next);
    };

    // При фокусе — если поле было пустое (показывался placeholder), подставляем
    // "+7 " чтобы юзер не вводил префикс вручную.
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = true;
      if (!text) setText('+7 ');
      rest.onFocus?.(e);
    };

    // При снятии фокуса — если кроме префикса ничего не введено, обнуляем,
    // чтобы placeholder снова стал виден. В противном случае text остаётся
    // как был (отформатированный частичный ввод).
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      isFocusedRef.current = false;
      if (!text || text === '+7' || text === '+7 ') {
        setText('');
        onChange?.('', '');
      }
      rest.onBlur?.(e);
    };

    return (
      <Input
        {...rest}
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        placeholder={PLACEHOLDER}
        value={text}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    );
  },
);

PhoneInput.displayName = 'PhoneInput';
