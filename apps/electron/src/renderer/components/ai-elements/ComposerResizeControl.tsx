import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  composerResizeHeightAtom,
  composerResizePreviewHeightAtom,
} from '@/atoms/ui-preferences'
import {
  COMPOSER_RESIZE_MAX_HEIGHT,
  COMPOSER_RESIZE_MIN_HEIGHT,
  clampComposerResizeHeight,
} from '@/lib/composer-resize'
import { ComposerResizeHandle } from './ComposerResizeHandle'

/** 连接共享高度状态与上边界手柄；Chat/Agent 使用同一套行为。 */
export function ComposerResizeControl({ maxHeight = COMPOSER_RESIZE_MAX_HEIGHT }: { maxHeight?: number }): React.ReactElement {
  const committedHeight = useAtomValue(composerResizeHeightAtom)
  const previewHeight = useAtomValue(composerResizePreviewHeightAtom)
  const setPreviewHeight = useSetAtom(composerResizePreviewHeightAtom)
  const setCommittedHeight = useSetAtom(composerResizeHeightAtom)

  const onResize = React.useCallback((height: number): void => {
    setPreviewHeight(height)
  }, [setPreviewHeight])

  const onResizeEnd = React.useCallback((height: number): void => {
    setPreviewHeight(null)
    setCommittedHeight(clampComposerResizeHeight(height, {
      minHeight: COMPOSER_RESIZE_MIN_HEIGHT,
      maxHeight,
    }))
  }, [maxHeight, setCommittedHeight, setPreviewHeight])

  return (
    <ComposerResizeHandle
      currentHeight={previewHeight ?? committedHeight}
      fallbackHeight={101}
      minHeight={COMPOSER_RESIZE_MIN_HEIGHT}
      maxHeight={maxHeight}
      onResize={onResize}
      onResizeEnd={onResizeEnd}
    />
  )
}
