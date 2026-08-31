import { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { useToast } from '../ui/Toast'
import { useLang } from '../../context/LanguageContext'
import { api } from '../../lib/api'
import { buildDmMessage } from '../../lib/dmMessage'

/**
 * DM-ийн хариу — хуулж илгээхэд бэлэн мессеж.
 *
 * ЯАГААД ШУУД ХУУЛАХГҮЙ ЦОНХ ГАРГАВ:
 * 1) илгээхийн өмнө нэг хараад авах боломж (алдаатай хаяг гэх мэт),
 * 2) тухайн хүнд зориулж жаахан засаж болно,
 * 3) clipboard хаалттай орчинд (http, зарим гар утас) гараар
 *    сонгож хуулах зам нээлттэй үлдэнэ.
 */
export default function DmReplyModal({ order, onClose }) {
  const { t } = useLang()
  const toast = useToast()
  const [settings, setSettings] = useState(null)
  /** null = хараахан гараар заваагүй — угсарсан эхийг шууд харуулна */
  const [edited, setEdited] = useState(null)
  const [copied, setCopied] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    api('/settings')
      .then(setSettings)
      .catch(() => setSettings({}))
  }, [])

  const built = useMemo(
    () => (settings ? buildDmMessage(order, settings) : ''),
    [order, settings],
  )

  const text = edited ?? built

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.show(t('Хуулагдлаа — DM руу буулгана уу'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard хаалттай — гараар сонгуулна
      ref.current?.select()
      toast.show(t('Гараар хуулна уу (Ctrl+C)'), { type: 'error' })
    }
  }

  return (
    <Modal open onClose={onClose} title={t('Үйлчлүүлэгч рүү илгээх хариу')}>
      <div className="space-y-4">
        {settings === null ? (
          <p className="text-sm text-ink-muted">{t('Ачааллаж байна…')}</p>
        ) : (
          <>
            <textarea
              ref={ref}
              aria-label={t('Илгээх мессеж')}
              value={text}
              onChange={(e) => setEdited(e.target.value)}
              rows={14}
              className="w-full bg-bg border border-rule rounded px-3 py-2 text-sm leading-relaxed resize-y focus:outline-none focus:border-ink-muted"
            />
            <p className="text-xs text-ink-muted">
              {t('Загварыг Тохиргоо хуудсаас өөрчилнө')}
            </p>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            {t('Хаах')}
          </Button>
          <Button onClick={copy} disabled={!text}>
            {copied ? `✓ ${t('Хуулсан')}` : t('Хуулах')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
