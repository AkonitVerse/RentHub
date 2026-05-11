import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Link2,
  Link2Off,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils/cn';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * WYSIWYG-редактор на TipTap. Производит HTML.
 * Используется для редактирования юридических документов и других длинных текстов.
 */
export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  // Флаг подавляет onUpdate-колбэк, когда содержимое меняется программно
  // (наша синхронизация при смене внешнего value), чтобы не помечать форму грязной.
  const isApplyingExternal = useRef(false);

  // Состояние диалога вставки/редактирования ссылки
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { class: 'text-blue underline', rel: 'noopener noreferrer' },
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      if (isApplyingExternal.current) return;
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] px-4 py-3',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
  });

  // Если value меняется снаружи (переключили документ) — синхронизируем содержимое.
  // Сравниваем с editor.getHTML(), чтобы не сбрасывать курсор при каждом нажатии.
  // Флаг isApplyingExternal предотвращает onUpdate, чтобы форма не помечалась
  // как «изменена» при программной загрузке.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (next !== current) {
      isApplyingExternal.current = true;
      // emitUpdate: false — не вызывать onUpdate, чтобы форма не помечалась как «изменена»
      // при программной загрузке. parseOptions с preserveWhitespace для корректной работы пробелов.
      editor.commands.setContent(next, { emitUpdate: false });
      // Сбрасываем флаг после микротаска, когда все события TipTap отстреляли.
      queueMicrotask(() => {
        isApplyingExternal.current = false;
      });
    }
  }, [value, editor]);

  if (!editor) return null;

  const handleOpenLinkDialog = () => {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
    setLinkUrl(previous || 'https://');
    setLinkDialogOpen(true);
  };

  const handleApplyLink = () => {
    const url = linkUrl.trim();
    if (!url || url === 'https://') {
      // пустая строка → снимаем ссылку
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setLinkDialogOpen(false);
  };

  const handleRemoveLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkDialogOpen(false);
  };

  return (
    <div className="rounded-md border border-border bg-surface overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-2 px-2 py-1.5">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Жирный (Ctrl+B)"
        >
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Курсив (Ctrl+I)"
        >
          <Italic className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Зачёркнутый"
        >
          <Strikethrough className="size-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Заголовок 2-го уровня"
        >
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Заголовок 3-го уровня"
        >
          <Heading3 className="size-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Маркированный список"
        >
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Нумерованный список"
        >
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Цитата"
        >
          <Quote className="size-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          active={editor.isActive('link')}
          onClick={handleOpenLinkDialog}
          title="Ссылка"
        >
          <Link2 className="size-4" />
        </ToolbarButton>
        {editor.isActive('link') && (
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Убрать ссылку"
          >
            <Link2Off className="size-4" />
          </ToolbarButton>
        )}

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Отменить (Ctrl+Z)"
          disabled={!editor.can().undo()}
        >
          <Undo2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Повторить (Ctrl+Y)"
          disabled={!editor.can().redo()}
        >
          <Redo2 className="size-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Диалог вставки/редактирования ссылки */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Вставить ссылку</DialogTitle>
            <DialogDescription>
              Введите адрес страницы, на которую будет вести ссылка.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rte-link-url">URL</Label>
            <Input
              id="rte-link-url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyLink();
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editor.isActive('link') ? (
              <Button variant="ghost" onClick={handleRemoveLink} className="text-status-overdue">
                <Link2Off className="size-4" /> Убрать ссылку
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleApplyLink}>Применить</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-text-2 transition-colors',
        'hover:bg-surface-3 hover:text-text',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue/50',
        'disabled:opacity-40 disabled:pointer-events-none',
        active &&
          'bg-blue text-white shadow-sm hover:bg-blue hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}
