/** Several playbooks per account. Existing play rows are left as they are. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    let playbooks
    try {
      playbooks = app.findCollectionByNameOrId('playbooks')
    } catch (_) {
      playbooks = new Collection({
        name: 'playbooks',
        type: 'base',
        fields: [
          {
            name: 'owner',
            type: 'relation',
            required: true,
            collectionId: users.id,
            cascadeDelete: true,
            minSelect: 1,
            maxSelect: 1,
          },
          {
            name: 'book_id',
            type: 'text',
            required: true,
            min: 1,
            max: 80,
          },
          {
            name: 'name',
            type: 'text',
            required: true,
            min: 1,
            max: 60,
          },
          {
            name: 'data',
            type: 'json',
            required: false,
            maxSize: 200000,
          },
          {
            name: 'deleted',
            type: 'bool',
          },
        ],
      })
    }

    playbooks.listRule = 'owner = @request.auth.id'
    playbooks.viewRule = 'owner = @request.auth.id'
    playbooks.createRule = '@request.auth.id != "" && owner = @request.auth.id'
    playbooks.updateRule = 'owner = @request.auth.id'
    playbooks.deleteRule = 'owner = @request.auth.id'
    playbooks.addIndex('idx_playbooks_owner_book_id', true, 'owner, book_id', '')
    app.save(playbooks)

    const plays = app.findCollectionByNameOrId('plays')
    if (!plays.fields.getByName('book_id')) {
      plays.fields.add(
        new Field({
          type: 'text',
          name: 'book_id',
          required: false,
          max: 80,
        }),
      )
      app.save(plays)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('playbooks'))
    } catch (_) {
      /* already gone */
    }
    const plays = app.findCollectionByNameOrId('plays')
    if (plays.fields.getByName('book_id')) {
      plays.fields.removeByName('book_id')
      app.save(plays)
    }
  },
)
