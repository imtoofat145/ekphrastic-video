import { useCallback, useEffect, useMemo, useState } from 'react'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HeadsetMicOutlinedIcon from '@mui/icons-material/HeadsetMicOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import {
  extractEmailDomain,
  verifyAssetEmailDomainAccess,
  verifyAssetPassword
} from '../../../../shared/asset-access/index.js'

const ACCESS_DECORATION_COLOR = '#1565c0'

function cleanOptionalText(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function descriptionText(value) {
  const cleaned = cleanOptionalText(value)
  if (cleaned === null) return null
  if (typeof DOMParser === 'undefined') {
    return cleaned.replace(/<[^>]*>/g, ' ').trim()
  }
  const document = new DOMParser().parseFromString(cleaned, 'text/html')
  return cleanOptionalText(document.body.textContent)
}

function AccessCue({ icon, heading, detail, tone }) {
  const colors = {
    blue: { color: '#1565c0', background: 'rgba(21, 101, 192, 0.08)' },
    green: { color: '#00897b', background: 'rgba(0, 137, 123, 0.08)' },
    violet: { color: '#6d4bc3', background: 'rgba(109, 75, 195, 0.08)' }
  }[tone]

  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          width: 42,
          height: 42,
          flex: '0 0 auto',
          borderRadius: '50%',
          color: colors.color,
          bgcolor: colors.background
        }}
      >
        {icon}
      </Box>
      <Box sx={{ pt: 0.25 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {heading}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.45 }}>
          {detail}
        </Typography>
      </Box>
    </Stack>
  )
}

/**
 * @param {{
 *   mode: 'password' | 'email',
 *   payloadListId: string,
 *   modeTest?: boolean,
 *   onApproved: (approval?: { email?: string }) => void,
 *   resourceTitle?: string | null,
 *   resourceDescription?: string | null,
 *   contactEmail?: string | null,
 *   resourceLogoUrl?: string | null
 * }} props
 */
export function ProtectedResourceAccess({
  mode,
  payloadListId,
  modeTest = false,
  onApproved,
  resourceTitle = null,
  resourceDescription = null,
  contactEmail = null,
  resourceLogoUrl = null
}) {
  const [value, setValue] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [status, setStatus] = useState('idle')
  const [submitting, setSubmitting] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)

  const isPassword = mode === 'password'
  const verifying = submitting || status === 'verifying'
  const decorationColor = ACCESS_DECORATION_COLOR
  const title = cleanOptionalText(resourceTitle)
  const detail = useMemo(() => descriptionText(resourceDescription), [resourceDescription])
  const email = cleanOptionalText(contactEmail)
  const logo = cleanOptionalText(resourceLogoUrl)

  useEffect(() => {
    setLogoFailed(false)
  }, [logo])

  const clearFeedback = () => {
    if (status === 'denied' || status === 'failure' || status === 'invalid-email') {
      setStatus('idle')
    }
  }

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      if (submitting) return

      if (isPassword) {
        const password = value
        if (!password.trim()) return
        setSubmitting(true)
        setStatus('verifying')
        const result = await verifyAssetPassword({
          payloadListId,
          password,
          modeTest
        })
        setSubmitting(false)
        if (result.kind === 'approved') {
          setStatus('idle')
          onApproved()
          return
        }
        setStatus(result.kind === 'denied' ? 'denied' : 'failure')
        return
      }

      if (!value.trim()) return
      const domain = extractEmailDomain(value)
      if (!domain) {
        setStatus('invalid-email')
        return
      }
      setSubmitting(true)
      setStatus('verifying')
      const result = await verifyAssetEmailDomainAccess({
        payloadListId,
        domain,
        modeTest
      })
      setSubmitting(false)
      if (result.kind === 'approved') {
        setStatus('idle')
        onApproved({ email: value.trim() })
        return
      }
      setStatus(result.kind === 'denied' ? 'denied' : 'failure')
    },
    [isPassword, modeTest, onApproved, payloadListId, submitting, value]
  )

  const heading = isPassword ? 'This video is password protected' : 'This video is restricted'
  const instruction = isPassword
    ? 'Enter the password to view this video.'
    : 'This video is restricted to authorised recipients. Enter your email to continue.'

  const submitDisabled =
    verifying || (isPassword ? value.trim().length === 0 : value.trim().length === 0)

  return (
    <Box
      data-testid="protected-resource-access"
      role="main"
      sx={{
        position: 'relative',
        minHeight: '100vh',
        overflow: 'hidden',
        bgcolor: '#f7faff',
        color: '#10182f',
        px: { xs: 2, sm: 3, lg: 6 },
        py: { xs: 2.5, sm: 3.5 },
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 'auto -12% -34% -12%',
          height: '72%',
          borderRadius: '50% 50% 0 0',
          background: `radial-gradient(ellipse at 48% 0%, ${alpha(decorationColor, 0.075)}, ${alpha(decorationColor, 0.04)} 54%, transparent 72%)`,
          pointerEvents: 'none'
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          width: { xs: 280, md: 520 },
          height: { xs: 280, md: 520 },
          right: { xs: -180, md: -210 },
          top: { xs: 130, md: 70 },
          borderRadius: '50%',
          bgcolor: alpha(decorationColor, 0.055),
          pointerEvents: 'none'
        }
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1440, mx: 'auto' }}>
        <Stack
          component="header"
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ width: '100%', minHeight: { xs: 48, sm: 64 } }}
        >
          <Box sx={{ minWidth: { xs: 0, sm: 180 }, minHeight: 40, flexShrink: 0 }}>
            {logo !== null && !logoFailed ? (
              <Box
                component="img"
                data-testid="protected-resource-logo"
                src={logo}
                alt={title ? `${title} logo` : 'Asset logo'}
                onError={() => setLogoFailed(true)}
                sx={{
                  display: 'block',
                  maxWidth: { xs: 140, sm: 190 },
                  maxHeight: 52,
                  objectFit: 'contain',
                  objectPosition: 'left center'
                }}
              />
            ) : null}
          </Box>

          <Stack
            direction="row"
            spacing={1.25}
            sx={{ ml: 'auto', flexShrink: 0, alignItems: 'center' }}
          >
            <HeadsetMicOutlinedIcon
              sx={{ color: 'primary.main', fontSize: 25, flexShrink: 0, alignSelf: 'center' }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700 }}>
                Need access?
              </Typography>
              {email !== null ? (
                <Typography
                  component="a"
                  href={`mailto:${email}`}
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  Contact {email}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </Stack>

        <Box
          component="main"
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              md: 'minmax(190px, 0.75fr) minmax(390px, 1.35fr)',
              lg: 'minmax(220px, 0.8fr) minmax(420px, 1.25fr) minmax(220px, 0.8fr)'
            },
            alignItems: 'center',
            gap: { xs: 3, md: 4, lg: 7 },
            minHeight: { xs: 'auto', md: 'calc(100vh - 140px)' },
            py: { xs: 4, md: 3 }
          }}
        >
          <Box sx={{ maxWidth: { xs: 620, md: 320 }, mx: { xs: 'auto', md: 0 } }}>
            {title !== null ? (
              <Typography
                data-testid="protected-resource-title"
                component="h1"
                sx={{
                  fontSize: { xs: '1.75rem', md: '2rem', lg: '2.25rem' },
                  lineHeight: 1.15,
                  letterSpacing: '-0.01em',
                  fontWeight: 700
                }}
              >
                {title}
              </Typography>
            ) : null}
            {detail !== null ? (
              <Typography
                data-testid="protected-resource-description"
                color="text.secondary"
                sx={{ mt: title !== null ? 2 : 0, fontSize: '1rem', fontWeight: 400, lineHeight: 1.55 }}
              >
                {detail}
              </Typography>
            ) : null}
            {title !== null || detail !== null ? (
              <Box sx={{ width: 96, mt: 3, borderBottom: '1px solid', borderColor: 'divider' }} />
            ) : null}
          </Box>

          <Paper
            elevation={0}
            sx={{
              width: '100%',
              maxWidth: 570,
              mx: 'auto',
              p: { xs: 3, sm: 4.5 },
              borderRadius: 3,
              border: '1px solid rgba(28, 70, 125, 0.1)',
              boxShadow: '0 18px 55px rgba(33, 77, 135, 0.14)',
              textAlign: 'center'
            }}
          >
            <Box
              sx={{
                display: 'grid',
                placeItems: 'center',
                width: 68,
                height: 68,
                mx: 'auto',
                mb: 1.75,
                borderRadius: '50%',
                color: 'primary.main',
                bgcolor: 'rgba(21, 101, 192, 0.08)'
              }}
            >
              {isPassword ? (
                <LockOutlinedIcon sx={{ fontSize: 34 }} />
              ) : (
                <MailOutlineOutlinedIcon sx={{ fontSize: 34 }} />
              )}
            </Box>

            <Typography component="h1" variant="h5" sx={{ fontWeight: 750 }}>
              {heading}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.25, mb: 3, lineHeight: 1.55 }}>
              {instruction}
            </Typography>

            <Box component="form" onSubmit={handleSubmit} noValidate>
              {isPassword ? (
                <TextField
                  autoFocus
                  fullWidth
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={value}
                  disabled={verifying}
                  autoComplete="current-password"
                  onChange={(event) => {
                    setValue(event.target.value)
                    clearFeedback()
                  }}
                  inputProps={{ 'aria-label': 'Password' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword((current) => !current)}
                          disabled={verifying}
                        >
                          {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </InputAdornment>
                    )
                  }}
                />
              ) : (
                <TextField
                  autoFocus
                  fullWidth
                  label="Email address"
                  placeholder="name@example.com"
                  type="email"
                  value={value}
                  disabled={verifying}
                  autoComplete="email"
                  onChange={(event) => {
                    setValue(event.target.value)
                    clearFeedback()
                  }}
                  inputProps={{
                    'aria-label': 'Email address',
                    placeholder: 'name@example.com'
                  }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutlineOutlinedIcon fontSize="small" />
                      </InputAdornment>
                    )
                  }}
                />
              )}

              {status === 'invalid-email' && (
                <Alert
                  severity="error"
                  variant="outlined"
                  role="alert"
                  sx={{
                    mt: 2,
                    textAlign: 'left',
                    bgcolor: 'rgba(211, 47, 47, 0.045)',
                    borderColor: 'rgba(211, 47, 47, 0.22)'
                  }}
                >
                  <AlertTitle sx={{ mb: 0.25, fontWeight: 700 }}>Enter a valid email address</AlertTitle>
                  Use a complete email address such as name@example.com.
                </Alert>
              )}

              {(status === 'denied' || status === 'failure') && (
                <Alert
                  severity="error"
                  variant="outlined"
                  role="alert"
                  sx={{
                    mt: 2,
                    textAlign: 'left',
                    bgcolor: 'rgba(211, 47, 47, 0.045)',
                    borderColor: 'rgba(211, 47, 47, 0.22)'
                  }}
                >
                  <AlertTitle sx={{ mb: 0.25, fontWeight: 700 }}>
                    {status === 'denied'
                      ? isPassword
                        ? 'Incorrect password'
                        : 'Email not authorised'
                      : 'Unable to verify access'}
                  </AlertTitle>
                  {status === 'denied'
                    ? isPassword
                      ? 'The password you entered is incorrect. Please try again.'
                      : 'This email is not authorised to access this video.'
                    : isPassword
                      ? "We couldn't verify the password. Please try again."
                      : "We couldn't verify your email. Please try again."}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={submitDisabled}
                endIcon={!verifying ? <ArrowForwardRoundedIcon /> : undefined}
                sx={{ mt: 2, minHeight: 50, fontWeight: 700, boxShadow: 'none' }}
              >
                {verifying ? (
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <CircularProgress size={19} color="inherit" />
                    <span>Verifying...</span>
                  </Stack>
                ) : (
                  'Continue'
                )}
              </Button>
            </Box>

            <Box
              sx={{
                mt: 3,
                pt: 2.5,
                borderTop: '1px solid',
                borderColor: 'divider',
                width: '100%',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={{ xs: 1.5, sm: 3 }}
                sx={{ display: 'inline-flex', justifyContent: 'center' }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {isPassword ? 'Password protected' : 'Email verification'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  Authorised recipients only
                </Typography>
              </Stack>
            </Box>
          </Paper>

          <Stack
            spacing={2.75}
            sx={{
              gridColumn: { xs: '1', md: '1 / -1', lg: 'auto' },
              maxWidth: { xs: 570, lg: 300 },
              mx: { xs: 'auto', lg: 0 },
              width: '100%',
              flexDirection: { xs: 'row', lg: 'column' },
              flexWrap: { xs: 'wrap', lg: 'nowrap' },
              justifyContent: 'center',
              '& > *': { flex: { xs: '1 1 220px', lg: '0 0 auto' } }
            }}
          >
            <AccessCue
              icon={<ShieldOutlinedIcon />}
              heading="Confidential"
              detail="Contains commercially sensitive information."
              tone="green"
            />
            {isPassword ? (
              <AccessCue
                icon={<LockOutlinedIcon />}
                heading="Password protected"
                detail="A password is required to open this video."
                tone="blue"
              />
            ) : (
              <AccessCue
                icon={<MailOutlineOutlinedIcon />}
                heading="Email verification"
                detail="An authorised email address is required to open this video."
                tone="blue"
              />
            )}
            <AccessCue
              icon={<GroupsOutlinedIcon />}
              heading="Authorised access"
              detail={
                isPassword
                  ? 'Use the password supplied by the person who shared this video.'
                  : 'Only intended and invited recipients can access this video with their email.'
              }
              tone="violet"
            />
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
