# Example: Building a Todo App from the Base App

This example shows how to use the base app to quickly build a new Todo application.

## Step 1: Customize Configuration

Update `lib/config.ts`:

```typescript
export const APP_CONFIG = {
  name: 'Todo Master',
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: 10000,
  },
  features: {
    profilePictures: true,
    userSettings: true,
    todos: true, // 👈 New feature flag
    categories: true, // 👈 New feature flag
  },
} as const;
```

## Step 2: Extend the API Client

Add todo methods to `lib/api.ts`:

```typescript
// Add to ApiClient interface
export interface ApiClient {
  // existing methods...
  getTodos<T>(token?: string): Promise<ApiResponse<T>>;
  createTodo<T>(todo: any, token?: string): Promise<ApiResponse<T>>;
  updateTodo<T>(id: string, todo: any, token?: string): Promise<ApiResponse<T>>;
  deleteTodo<T>(id: string, token?: string): Promise<ApiResponse<T>>;
}

// Add to BaseApiClient class
class BaseApiClient implements ApiClient {
  // existing methods...

  async getTodos<T>(token?: string): Promise<ApiResponse<T>> {
    return this.get('/api/todos', token);
  }

  async createTodo<T>(todo: any, token?: string): Promise<ApiResponse<T>> {
    return this.post('/api/todos', todo, token);
  }

  async updateTodo<T>(id: string, todo: any, token?: string): Promise<ApiResponse<T>> {
    return this.put(`/api/todos/${id}`, todo, token);
  }

  async deleteTodo<T>(id: string, token?: string): Promise<ApiResponse<T>> {
    return this.delete(`/api/todos/${id}`, token);
  }
}
```

## Step 3: Create Todo Types

Create `types/todo.ts`:

```typescript
export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoFormData {
  title: string;
  description?: string;
  category?: string;
}
```

## Step 4: Create Todo Screen

Create `app/(tabs)/todos.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { Todo } from '@/types/todo';

export default function TodosScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  const loadTodos = async () => {
    setLoading(true);
    try {
      const response = await api.getTodos(token);
      if (response.data) {
        setTodos(response.data);
      }
    } catch (error) {
      console.error('Failed to load todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    try {
      const updated = { ...todo, completed: !todo.completed };
      const response = await api.updateTodo(todo.id, updated, token);
      if (response.data) {
        setTodos(prev => prev.map(t => t.id === todo.id ? updated : t));
      }
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  useEffect(() => {
    if (token) {
      loadTodos();
    }
  }, [token]);

  const renderTodo = ({ item }: { item: Todo }) => (
    <View style={styles.todoItem}>
      <ThemedText
        style={[styles.todoTitle, item.completed && styles.completed]}
        onPress={() => toggleTodo(item)}
      >
        {item.completed ? '✅' : '⭕'} {item.title}
      </ThemedText>
      {item.description && (
        <ThemedText style={styles.todoDescription}>
          {item.description}
        </ThemedText>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.header}>My Todos</ThemedText>
      <FlatList
        data={todos}
        renderItem={renderTodo}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadTodos}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  todoItem: { padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: '#f0f0f0' },
  todoTitle: { fontSize: 16, fontWeight: '500' },
  todoDescription: { fontSize: 14, opacity: 0.7, marginTop: 4 },
  completed: { textDecorationLine: 'line-through', opacity: 0.6 },
});
```

## Step 5: Add Todo Creation

Create `components/AddTodoForm.tsx`:

```typescript
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { ThemedButton } from '@/components/ThemedButton';
import { api } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import { TodoFormData } from '@/types/todo';

interface AddTodoFormProps {
  onTodoAdded: () => void;
}

export function AddTodoForm({ onTodoAdded }: AddTodoFormProps) {
  const [formData, setFormData] = useState<TodoFormData>({
    title: '',
    description: '',
    category: '',
  });
  const [saving, setSaving] = useState(false);
  const { token } = useAuth();

  const handleSubmit = async () => {
    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      const response = await api.createTodo({
        ...formData,
        completed: false,
      }, token);

      if (response.data) {
        setFormData({ title: '', description: '', category: '' });
        onTodoAdded();
      }
    } catch (error) {
      console.error('Failed to create todo:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedTextInput
        placeholder="Todo title"
        value={formData.title}
        onChangeText={(title) => setFormData(prev => ({ ...prev, title }))}
        style={styles.input}
      />
      <ThemedTextInput
        placeholder="Description (optional)"
        value={formData.description}
        onChangeText={(description) => setFormData(prev => ({ ...prev, description }))}
        style={styles.input}
        multiline
      />
      <ThemedButton
        title={saving ? 'Adding...' : 'Add Todo'}
        onPress={handleSubmit}
        disabled={saving || !formData.title.trim()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f8f8f8', marginBottom: 16 },
  input: { marginBottom: 12 },
});
```

## Step 6: Update the Home Tab

Replace the content in `app/(tabs)/index.tsx`:

```typescript
import { View } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { AddTodoForm } from '@/components/AddTodoForm';

export default function HomeScreen() {
  const handleTodoAdded = () => {
    // Could refresh a todo list or show a success message
    console.log('Todo added!');
  };

  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 16 }}>
        Welcome to Todo Master!
      </ThemedText>
      <AddTodoForm onTodoAdded={handleTodoAdded} />
    </ThemedView>
  );
}
```

## Step 7: Add Storage for Offline Support

Extend `lib/storage.ts`:

```typescript
// Add to STORAGE_KEYS
export const STORAGE_KEYS = {
  // existing keys...
  TODOS: 'todos',
  LAST_TODO_SYNC: 'last_todo_sync',
} as const;
```

## Step 8: Add Utility Functions

Add to `lib/utils.ts`:

```typescript
/**
 * Filter todos by completion status
 */
export const filterTodosByStatus = (todos: Todo[], completed: boolean): Todo[] => {
  return todos.filter(todo => todo.completed === completed);
};

/**
 * Group todos by category
 */
export const groupTodosByCategory = (todos: Todo[]): Record<string, Todo[]> => {
  return todos.reduce(
    (groups, todo) => {
      const category = todo.category || 'Uncategorized';
      groups[category] = groups[category] || [];
      groups[category].push(todo);
      return groups;
    },
    {} as Record<string, Todo[]>
  );
};

/**
 * Sort todos by creation date
 */
export const sortTodosByDate = (todos: Todo[], descending = true): Todo[] => {
  return [...todos].sort((a, b) => {
    const dateA = new Date(a.createdAt).getTime();
    const dateB = new Date(b.createdAt).getTime();
    return descending ? dateB - dateA : dateA - dateB;
  });
};
```

## Step 9: Add Tests

Create `__tests__/lib/todo-utils.test.ts`:

```typescript
import { filterTodosByStatus, groupTodosByCategory } from '../../lib/utils';
import { Todo } from '../../types/todo';

const mockTodos: Todo[] = [
  {
    id: '1',
    title: 'Buy groceries',
    completed: false,
    category: 'Personal',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    title: 'Write tests',
    completed: true,
    category: 'Work',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '3',
    title: 'Call mom',
    completed: false,
    category: 'Personal',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('Todo utilities', () => {
  test('filterTodosByStatus should filter completed todos', () => {
    const completed = filterTodosByStatus(mockTodos, true);
    expect(completed).toHaveLength(1);
    expect(completed[0].title).toBe('Write tests');
  });

  test('groupTodosByCategory should group todos correctly', () => {
    const grouped = groupTodosByCategory(mockTodos);
    expect(grouped.Personal).toHaveLength(2);
    expect(grouped.Work).toHaveLength(1);
  });
});
```

## Result

With just these changes, you've transformed the base app into a fully functional todo application with:

- ✅ Authentication (inherited from base app)
- ✅ User settings and profile (inherited from base app)
- ✅ Todo creation, editing, and completion
- ✅ Categories and filtering
- ✅ Offline storage capabilities
- ✅ Comprehensive testing
- ✅ Cross-platform support

The base app's modular architecture made it easy to add new features while reusing existing authentication, API handling, storage, and UI components.

## Time Saved

Instead of building from scratch (2-3 weeks), you built a complete todo app in a few hours by leveraging the base app's foundation! 🚀
