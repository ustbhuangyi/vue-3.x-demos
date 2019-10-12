import { filters, todoStorage, pluralize } from './util'
import { compile, h, createApp, onMounted, onUnmounted, reactive, computed, effect, watch } from '@vue/vue'

const RootComponent = {
  render () {
    return h(TodoComp)
  }
}

const TodoComp = {
  render: compile(document.getElementById('todo-template').innerHTML),

  setup () {
    const state = reactive({
      todos: todoStorage.fetch(),
      editedTodo: null,
      newTodo: '',
      beforeEditCache: '',
      visibility: 'all',
      remaining: computed(() => {
        return filters.active(state.todos).length
      }),
      remainingText: computed(() => {
        return ` ${pluralize(state.remaining)} left`
      }),
      filteredTodos: computed(() => {
        return filters[state.visibility](state.todos)
      }),
      allDone: computed({
        get: function () {
          return state.remaining === 0
        },
        set: function (value) {
          state.todos.forEach((todo) => {
            todo.completed = value
          })
        }
      })
    })


    watch(effect(() => {
      todoStorage.save(state.todos)
    }), {
      deep: true
    })

    onMounted(() => {
      window.addEventListener('hashchange', onHashChange)
      onHashChange()
    })

    onUnmounted(() => {
      window.removeEventListener('hashchange', onHashChange)
    })

    function onHashChange () {
      const visibility = window.location.hash.replace(/#\/?/, '')
      if (filters[visibility]) {
        state.visibility = visibility
      } else {
        window.location.hash = ''
        state.visibility = 'all'
      }
    }

    function onNewTodoKeyup (event) {
      if (event.code === 'Enter') {
        addTodo()
      }
    }

    function onEditKeyup (event, todo) {
      if (event.code === 'Enter') {
        doneEdit(todo)
      } else if (event.code === 'Escape') {
        cancelEdit(todo)
      }
    }

    function addTodo () {
      const value = state.newTodo && state.newTodo.trim()
      if (!value) {
        return
      }
      state.todos.push({
        id: todoStorage.uid++,
        title: value,
        completed: false
      })
      state.newTodo = ''
    }

    function removeTodo (todo) {
      state.todos.splice(state.todos.indexOf(todo), 1)
    }

    function editTodo (todo) {
      state.beforeEditCache = todo.title
      state.editedTodo = todo
    }

    function doneEdit (todo) {
      if (!state.editedTodo) {
        return
      }
      state.editedTodo = null
      todo.title = todo.title.trim()
      if (!todo.title) {
        removeTodo(todo)
      }
    }

    function cancelEdit (todo) {
      state.editedTodo = null
      todo.title = state.beforeEditCache
    }

    function removeCompleted () {
      state.todos = filters.active(state.todos)
    }

    return {
      state,
      onNewTodoKeyup,
      onEditKeyup,
      removeTodo,
      editTodo,
      doneEdit,
      removeCompleted
    }
  }
}

createApp().mount(RootComponent, '#app')

