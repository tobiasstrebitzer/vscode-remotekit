import { Fragment, useEffect, useRef } from 'react'
import type { PathSegment } from '@shared/protocol'

interface Props {
  segments: PathSegment[]
  onNavigate: (path: string) => void
  onUpload: (files: File[]) => void
}

export function Breadcrumb({ segments, onNavigate, onUpload }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollLeft = ref.current.scrollWidth
    }
  }, [segments])

  return (
    <div className="breadcrumb">
      <span className="bc-icon codicon codicon-folder" />
      <div className="crumbs" ref={ref}>
        {segments.map((segment, index) => index === 0
          ? (
            <span key={segment.path} className="sep root" title={segment.path} onClick={() => onNavigate(segment.path)}>/</span>
          )
          : (
            <Fragment key={segment.path}>
              {index > 1 && <span className="sep">/</span>}
              <span
                className={index === segments.length - 1 ? 'crumb current' : 'crumb'}
                title={segment.path}
                onClick={() => onNavigate(segment.path)}
              >
                {segment.label}
              </span>
            </Fragment>
          ))}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={event => {
          const files = Array.from(event.target.files ?? [])
          if (files.length > 0) {
            onUpload(files)
          }
          event.target.value = ''
        }}
      />
      <button
        className="bc-action codicon codicon-cloud-upload"
        title="Upload files to the selected folder (or hold ⇧ Shift and drag files in)"
        onClick={() => input.current?.click()}
      />
    </div>
  )
}
