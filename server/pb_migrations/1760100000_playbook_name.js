/** Playbook name lives on the account so a second phone shows the same name. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('playbook_name')) {
      users.fields.add(
        new Field({
          type: 'text',
          name: 'playbook_name',
          required: false,
          max: 60,
        }),
      )
    }
    if (!users.fields.getByName('playbook_named_at')) {
      users.fields.add(
        new Field({
          type: 'number',
          name: 'playbook_named_at',
          required: false,
        }),
      )
    }
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.fields.removeByName('playbook_name')
    users.fields.removeByName('playbook_named_at')
    app.save(users)
  },
)
