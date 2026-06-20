interface Props {
  onDismiss: () => void
}

export function UploadHint({ onDismiss }: Props) {
  return (
    <div className="upload-hint">
      <span className="upload-hint-text">Hold <kbd>⇧ Shift</kbd> while dragging files in to upload.</span>
      <button className="upload-hint-close codicon codicon-close" title="Dismiss" onClick={onDismiss} />
    </div>
  )
}
