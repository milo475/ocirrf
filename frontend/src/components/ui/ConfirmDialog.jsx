import Button from './Button'
import Modal from './Modal'

/** Баталгаажуулах асуулт — Modal дээр суурилсан */
export default function ConfirmDialog({
  open,
  title = 'Баталгаажуулах',
  message,
  confirmLabel = 'Тийм',
  cancelLabel = 'Болих',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">{message}</p>
    </Modal>
  )
}
