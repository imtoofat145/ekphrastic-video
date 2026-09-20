function PresentationInfoPanel({ description, firstSlideImageUrl }) {
  const showImage = Boolean(firstSlideImageUrl?.trim())

  if (!description?.trim()) return null

  return (
    <div className="menu-content presentation-info-panel">
      {showImage && (
        <div className="presentation-info-image-wrap">
          <img
            src={firstSlideImageUrl}
            alt="Video preview"
            className="presentation-info-image"
          />
        </div>
      )}

      <section className={`about-bio-card${showImage ? '' : ' presentation-info-description-only'}`}>
        <p className="about-bio-text">{description}</p>
      </section>
    </div>
  )
}

export default PresentationInfoPanel
