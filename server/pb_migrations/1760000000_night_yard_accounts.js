/** Username sign-in and a per-user plays collection. PocketBase 0.40 already
 *  creates `users` with email as the identity. This switches that to username. */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    const email = users.fields.getByName('email')
    if (email) email.required = false

    const password = users.fields.getByName('password')
    if (password) password.min = 8

    if (!users.fields.getByName('username')) {
      users.fields.add(
        new Field({
          type: 'text',
          name: 'username',
          required: true,
          presentable: true,
          min: 3,
          max: 30,
          pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{2,29}$',
        }),
      )
    }

    users.passwordAuth.identityFields = ['username']
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.createRule = ''
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = null
    users.addIndex('idx_users_username', true, 'username', '')
    app.save(users)

    let plays
    try {
      plays = app.findCollectionByNameOrId('plays')
    } catch (_) {
      plays = new Collection({
        name: 'plays',
        type: 'base',
        listRule: 'owner = @request.auth.id',
        viewRule: 'owner = @request.auth.id',
        createRule: 'owner = @request.auth.id',
        updateRule: 'owner = @request.auth.id',
        deleteRule: 'owner = @request.auth.id',
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
            name: 'play_id',
            type: 'text',
            required: true,
            min: 1,
            max: 80,
          },
          {
            name: 'data',
            type: 'json',
            required: true,
            maxSize: 2000000,
          },
          {
            name: 'deleted',
            type: 'bool',
          },
        ],
      })
    }

    plays.listRule = 'owner = @request.auth.id'
    plays.viewRule = 'owner = @request.auth.id'
    plays.createRule = 'owner = @request.auth.id'
    plays.updateRule = 'owner = @request.auth.id'
    plays.deleteRule = 'owner = @request.auth.id'
    plays.addIndex('idx_plays_owner_play_id', true, 'owner, play_id', '')
    app.save(plays)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('plays'))
    } catch (_) {
      /* already gone */
    }

    const users = app.findCollectionByNameOrId('users')
    users.passwordAuth.identityFields = ['email']
    users.removeIndex('idx_users_username')
    users.fields.removeByName('username')
    const email = users.fields.getByName('email')
    if (email) email.required = true
    app.save(users)
  },
)
