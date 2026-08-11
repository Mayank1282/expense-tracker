<?php

namespace App\Notifications;

use App\Models\PasswordReset;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ResetPasswordLink extends Notification
{
    use Queueable;

    public function __construct(
        private readonly string $token,
        private readonly string $email,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = url('/reset-password/'.$this->token.'?email='.urlencode($this->email));

        return (new MailMessage)
            ->subject('Reset your Ledger password')
            ->greeting('Password reset')
            ->line('Someone asked to reset the password for this Ledger account.')
            ->action('Choose a new password', $url)
            ->line('The link stops working in '.PasswordReset::EXPIRY_MINUTES.' minutes.')
            ->line('If this was not you, ignore this email — nothing has changed and your ledger is untouched.')
            ->salutation('— Ledger');
    }
}
