import * as React from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  showStrengthIndicator?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showStrengthIndicator, value, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const stringValue = typeof value === 'string' ? value : '';

    const rules = [
      { id: 'length', text: 'At least 8 characters', fulfilled: stringValue.length >= 8 },
      { id: 'upper', text: 'At least 1 uppercase letter', fulfilled: /[A-Z]/.test(stringValue) },
      { id: 'number', text: 'At least 1 number', fulfilled: /\d/.test(stringValue) },
    ];

    return (
      <div className="w-full space-y-2">
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            className={cn('pr-10', className)}
            ref={ref}
            value={value}
            {...props}
          />
          <button
            type="button"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </button>
        </div>

        {showStrengthIndicator && (
          <div className="space-y-1 mt-2">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-2 text-xs">
                {rule.fulfilled ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <X className="h-3.5 w-3.5 text-muted-foreground/50" />
                )}
                <span className={rule.fulfilled ? 'text-emerald-600' : 'text-muted-foreground'}>
                  {rule.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
