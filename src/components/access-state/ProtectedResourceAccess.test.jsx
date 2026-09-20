// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProtectedResourceAccess } from './ProtectedResourceAccess.jsx'

vi.mock('../../../shared/asset-access/index.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    verifyAssetPassword: vi.fn(),
    verifyAssetEmailDomainAccess: vi.fn()
  }
})

import {
  verifyAssetEmailDomainAccess,
  verifyAssetPassword
} from '../../../shared/asset-access/index.js'

describe('ProtectedResourceAccess', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('password mode shows masked field and calls verify with payload list id', async () => {
    verifyAssetPassword.mockResolvedValue({ kind: 'approved' })
    const onApproved = vi.fn()

    render(
      <ProtectedResourceAccess
        mode="password"
        payloadListId="list-password"
        onApproved={onApproved}
      />
    )

    const input = screen.getByLabelText('Password')
    expect(input.getAttribute('type')).toBe('password')
    fireEvent.change(input, { target: { value: 'secret' } })
    fireEvent.submit(input.closest('form'))

    await waitFor(() => {
      expect(verifyAssetPassword).toHaveBeenCalledWith({
        payloadListId: 'list-password',
        password: 'secret',
        modeTest: false
      })
      expect(onApproved).toHaveBeenCalledWith()
    })
  })

  it('email mode uses visible field and verifies domain only', async () => {
    verifyAssetEmailDomainAccess.mockResolvedValue({ kind: 'approved' })
    const onApproved = vi.fn()

    render(
      <ProtectedResourceAccess
        mode="email"
        payloadListId="list-email"
        modeTest
        onApproved={onApproved}
      />
    )

    expect(screen.getByLabelText('Email address').getAttribute('type')).toBe('email')
    expect(screen.queryByText(/domain/i)).toBeNull()

    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'user@Acme.COM' }
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Continue' }).closest('form'))

    await waitFor(() => {
      expect(verifyAssetEmailDomainAccess).toHaveBeenCalledWith({
        payloadListId: 'list-email',
        domain: 'acme.com',
        modeTest: true
      })
      expect(onApproved).toHaveBeenCalledWith({ email: 'user@Acme.COM' })
    })
    expect(verifyAssetEmailDomainAccess.mock.calls[0][0]).not.toHaveProperty('email')
  })

  it('renders payload logo when resourceLogoUrl is valid', () => {
    render(
      <ProtectedResourceAccess
        mode="password"
        payloadListId="list-logo"
        onApproved={vi.fn()}
        resourceTitle="Demo Video"
        resourceLogoUrl="https://cdn.example/logo.png"
      />
    )

    const img = screen.getByTestId('protected-resource-logo')
    expect(img.getAttribute('src')).toBe('https://cdn.example/logo.png')
    expect(img.getAttribute('alt')).toBe('Demo Video logo')
  })

  it('omits logo element when resourceLogoUrl is missing or blank', () => {
    const { rerender } = render(
      <ProtectedResourceAccess mode="password" payloadListId="list-x" onApproved={vi.fn()} />
    )
    expect(screen.queryByTestId('protected-resource-logo')).toBeNull()

    rerender(
      <ProtectedResourceAccess
        mode="password"
        payloadListId="list-x"
        onApproved={vi.fn()}
        resourceLogoUrl="   "
      />
    )
    expect(screen.queryByTestId('protected-resource-logo')).toBeNull()
  })

  it('renders Need access utility with contact email alongside optional logo', () => {
    render(
      <ProtectedResourceAccess
        mode="password"
        payloadListId="list-x"
        onApproved={vi.fn()}
        contactEmail="help@example.com"
        resourceLogoUrl="https://cdn.example/logo.png"
      />
    )

    expect(screen.getByText('Need access?')).toBeTruthy()
    const link = screen.getByRole('link', { name: /Contact help@example.com/i })
    expect(link.getAttribute('href')).toBe('mailto:help@example.com')
    expect(screen.getByTestId('protected-resource-logo')).toBeTruthy()
  })

  it('logo presence does not change password verification behaviour', async () => {
    verifyAssetPassword.mockResolvedValue({ kind: 'approved' })
    const onApproved = vi.fn()

    render(
      <ProtectedResourceAccess
        mode="password"
        payloadListId="list-with-logo"
        onApproved={onApproved}
        resourceLogoUrl="https://cdn.example/logo.png"
      />
    )

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Continue' }).closest('form'))

    await waitFor(() => {
      expect(verifyAssetPassword).toHaveBeenCalled()
      expect(onApproved).toHaveBeenCalledWith()
    })
  })

  it('denied keeps onApproved uncalled', async () => {
    verifyAssetPassword.mockResolvedValue({ kind: 'denied' })
    const onApproved = vi.fn()

    render(
      <ProtectedResourceAccess mode="password" payloadListId="list-x" onApproved={onApproved} />
    )

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'bad' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Continue' }).closest('form'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/incorrect/i)
      expect(onApproved).not.toHaveBeenCalled()
    })
  })
})

