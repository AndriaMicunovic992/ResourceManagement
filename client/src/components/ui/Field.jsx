import { cloneElement, isValidElement, useId } from 'react';

export default function Field({ label, children }) {
  const id = useId();
  // Wire the label to a single child input so clicking it focuses the control.
  const child =
    isValidElement(children) && !children.props.id
      ? cloneElement(children, { id })
      : children;
  return (
    <div className="mb-4">
      <label
        htmlFor={isValidElement(children) ? children.props.id || id : undefined}
        className="block text-xs font-semibold text-text-mid mb-1.5 tracking-wide"
      >
        {label}
      </label>
      {child}
    </div>
  );
}
