name: Pull request

description: Propose a focused change

body:
  - type: textarea
    id: summary
    attributes:
      label: Summary
      description: What changed and why?
    validations:
      required: true
  - type: textarea
    id: verification
    attributes:
      label: Verification
      description: List the commands or manual scenarios actually run.
      placeholder: "- [ ] bun test --isolate"
  - type: textarea
    id: risks
    attributes:
      label: User-visible effects and risks
  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: I did not include secrets, personal data, local databases, or generated build output.
          required: true
        - label: I added or updated tests for changed behavior where appropriate.
          required: true
