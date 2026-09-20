import { DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default'

/**
 * Default Vidstack controls — swap this component for custom controls later.
 */
export default function VideoPlayerControls() {
  return (
    <DefaultVideoLayout
      icons={defaultLayoutIcons}
      slots={{
        googleCastButton: null,
        pipButton: null
      }}
    />
  )
}
