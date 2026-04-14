import { toast } from 'react-toastify'

export const notifySuccess = (message) => {
  toast.success(message, { position: 'top-right' })
}

export const notifyError = (message) => {
  toast.error(message, { position: 'top-right' })
}

export const notifyInfo = (message) => {
  toast.info(message, { position: 'top-right' })
}

export const confirmToast = (message, confirmLabel = 'Ya, lanjutkan') =>
  new Promise((resolve) => {
    const id = toast(
      ({ closeToast }) => (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">{message}</p>
          <div className="flex gap-2">
            <button
              className="btn-danger px-3 py-1.5 text-xs"
              onClick={() => {
                resolve(true)
                closeToast()
              }}
            >
              {confirmLabel}
            </button>
            <button
              className="btn-secondary px-3 py-1.5 text-xs"
              onClick={() => {
                resolve(false)
                closeToast()
              }}
            >
              Batal
            </button>
          </div>
        </div>
      ),
      {
        closeOnClick: false,
        autoClose: false,
        closeButton: false,
        position: 'top-center',
        onClose: () => resolve(false),
      },
    )

    return id
  })
