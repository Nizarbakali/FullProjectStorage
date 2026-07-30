import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getMonthlyData } from '../services/api'

export const fetchMonthlyData = createAsyncThunk(
  'charts/fetchMonthlyData',
  async (_, { rejectWithValue }) => {
    try {
      const data = await getMonthlyData()
      return data || []
    } catch (err) {
      return rejectWithValue(err.message || 'Échec du chargement des données')
    }
  }
)

const chartsSlice = createSlice({
  name: 'charts',
  initialState: {
    rawData: [],
    availableYears: [],
    selectedYear: new Date().getFullYear().toString(),
    availableArticleNames: [],
    selectedArticleName: 'general',
    loading: false,
    error: null,
  },
  reducers: {
    setSelectedYear: (state, action) => {
      state.selectedYear = action.payload
    },
    setSelectedArticleName: (state, action) => {
      state.selectedArticleName = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMonthlyData.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchMonthlyData.fulfilled, (state, action) => {
        state.loading = false
        state.rawData = action.payload

        // Extract available years from mois field
        const years = new Set()
        action.payload.forEach(row => {
          if (row.mois) years.add(row.mois.substring(0, 4))
        })
        const yearsArray = Array.from(years).sort().reverse()
        state.availableYears = yearsArray

        if (yearsArray.length > 0 && !yearsArray.includes(state.selectedYear)) {
          state.selectedYear = yearsArray[0]
        }

        // Extract unique article names
        const names = new Set()
        action.payload.forEach(row => {
          if (row.nomArticle) names.add(row.nomArticle)
        })
        state.availableArticleNames = Array.from(names).sort()

        if (state.selectedArticleName !== 'general' && !names.has(state.selectedArticleName)) {
          state.selectedArticleName = 'general'
        }
      })
      .addCase(fetchMonthlyData.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
      })
  }
})

export const { setSelectedYear, setSelectedArticleName } = chartsSlice.actions
export default chartsSlice.reducer
